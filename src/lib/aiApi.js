/**
 * AI Assistant API layer.
 *
 * Request flow:
 *   Frontend  →  POST {VITE_BACKEND_URL}/ai/chat  →  FastAPI  →  Gemini
 *
 * The VITE_BACKEND_URL env var must point at the running FastAPI server
 * (default: http://localhost:8000). If the backend is unreachable the
 * function throws with a descriptive message so the UI can show it.
 */

import { supabase } from './supabaseClient';
import { getBackendUrl } from './backendApi';

const TIMEOUT_MS = 55_000;

async function _getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
  }
  return { 'Content-Type': 'application/json' };
}

async function _fetchWithTimeout(url, options, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function askCaregiverAssistant({ message, patientId, language }) {
  const BACKEND_URL = getBackendUrl();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in to use the AI assistant.');

  const payload = {
    message,
    patient_id: patientId || null,
    language: language || 'en',
  };

  const headers = await _getAuthHeaders();

  try {
    const res = await _fetchWithTimeout(`${BACKEND_URL}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = '';
      try { const body = await res.json(); detail = body.detail || ''; } catch { detail = await res.text().catch(() => ''); }
      if (res.status === 429) throw new Error('AI service is busy. Please wait a moment and try again.');
      if (res.status === 504) throw new Error('The AI assistant took too long to respond. Please try again.');
      if (res.status === 503) throw new Error('AI service is temporarily unavailable. Check that the backend is running.');
      throw new Error(`Request failed (${res.status}): ${detail || res.statusText}`);
    }

    const data = await res.json();
    return data.response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The AI assistant took too long to respond. Please try again.');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(
        `Cannot reach the backend server at ${BACKEND_URL}. ` +
        'Make sure the FastAPI server is running (uvicorn main:app --reload).'
      );
    }
    throw error;
  }
}

export async function generateScenarioWithAuth(patientId) {
  if (!patientId) throw new Error('patientId is required to generate a scenario.');

  const BACKEND_URL = getBackendUrl();

  const headers = await _getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('You must be signed in to generate AI scenarios.');
  }

  try {
    const res = await _fetchWithTimeout(
      `${BACKEND_URL}/ai/assistant/generate-scenario`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ patient_id: patientId }),
      },
      60_000, // 60s for LLM scenario generation
    );

    if (!res.ok) {
      let detail = '';
      try { const body = await res.json(); detail = body.detail || ''; } catch { detail = await res.text().catch(() => ''); }
      if (res.status === 401) throw new Error('Session expired. Please sign in again.');
      if (res.status === 403) throw new Error('You do not have access to generate scenarios for this patient.');
      if (res.status === 429) throw new Error('AI service is busy. Please wait a moment and try again.');
      if (res.status === 503) throw new Error('AI service is not configured on the server. Contact your administrator.');
      if (res.status === 504) throw new Error('Scenario generation timed out. Please try again.');
      throw new Error(`Scenario generation failed (${res.status}): ${detail || res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Scenario generation timed out. Please try again.');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(
        `Cannot reach the backend at ${BACKEND_URL}. ` +
        'Make sure the FastAPI server is running.'
      );
    }
    throw error;
  }
}
