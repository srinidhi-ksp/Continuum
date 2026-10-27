const TIMEOUT_MS = 20000;
const OUT_OF_SCOPE = /\b(president|prime minister|capital of|weather|sports|score|poem|homework|movie|actor|actress|crypto|bitcoin|stock price|election|celebrity|recipe|tell me a joke|who is the president)\b/i;
const MEDICAL_DECISION = /\b(recommend.*(medication|medicine|drug|treatment|dose|pill)|which medicine|what medicine|change.*(dosage|dose|medicine)|increase.*dose|decrease.*dose|stop.*(medication|medicine)|prescribe|what dose|what pill|should (i|we) give|can (i|we) give|give (her|him|them).*pill|dosage of|mg of)\b/i;

export async function askCaregiverAssistant({ message, patientContext = {}, language = "en", accessToken }) {
  const text = String(message || "").trim();
  if (!text) throw new Error("Enter a question about care coordination.");
  if (OUT_OF_SCOPE.test(text)) return "I can help with patient care coordination and safe caregiving only, not general-knowledge or out-of-scope questions.";
  if (MEDICAL_DECISION.test(text)) return "I cannot recommend, prescribe, start, stop, or change medication or dosage. Please contact the patient’s prescribing physician or pharmacist for all medication guidance. If this may be urgent, seek local emergency medical care immediately.";
  const backend = import.meta.env.VITE_BACKEND_URL;
  if (!backend) throw new Error("AI assistant is not configured. Set VITE_BACKEND_URL to your backend URL.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${backend.replace(/\/$/, "")}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ message: text, context: patientContext, language }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.message || `AI service returned ${response.status}.`);
    if (typeof data.response !== "string" || !data.response.trim()) throw new Error("AI service returned an empty response. Please retry.");
    return data.response;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("AI request timed out. Please retry.", { cause: error });
    if (error.message?.includes("Failed to fetch")) throw new Error("Cannot reach the AI backend. Check that the backend is running and configured.", { cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
