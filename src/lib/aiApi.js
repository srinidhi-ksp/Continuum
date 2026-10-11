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

const TIMEOUT_MS = 30_000; // 30-second timeout for AI responses

export async function askCaregiverAssistant({ message, patientContext, language }) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const payload = {
    message,
    context: patientContext || {},
    language: language || "en",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Backend returned ${res.status}: ${detail || res.statusText}`
      );
    }

    const data = await res.json();
    return data.response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The AI assistant took too long to respond. Please try again.", { cause: error });
    }
    if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
      throw new Error(
        `Cannot reach the backend server at ${BACKEND_URL}. ` +
        "Make sure the FastAPI server is running (uvicorn main:app --reload).",
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
