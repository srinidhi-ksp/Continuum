import { useState, useRef, useEffect } from "react";
import { Mic } from "lucide-react";

const SPEECH_LANGS = {
  English: "en-US",
  Tamil: "ta-IN",
  Hindi: "hi-IN",
};

export default function VoiceInputButton({ onTranscript, style = {}, currentText = "" }) {
  const [isListening, setIsListening] = useState(false);
  const [supported] = useState(() => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recognitionRef = useRef(null);

  // Retrieve user language preference from localStorage
  let savedLang = "English";
  try {
    const raw = localStorage.getItem("continuum_user_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.language) savedLang = parsed.language;
    }
  } catch {
    // fallback to English
  }

  const langCode = SPEECH_LANGS[savedLang] || "en-US";

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = langCode;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript && onTranscript) {
        const separator = currentText && !currentText.endsWith(" ") ? " " : "";
        onTranscript((currentText || "") + separator + transcript);
      }
    };
    recognition.onerror = (e) => {
      console.warn("[VoiceInputButton] Recognition error:", e.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore already stopped error
      }
    };
  }, [langCode, currentText, onTranscript]);

  const toggleListen = (e) => {
    e.preventDefault();
    if (!supported) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn("[VoiceInputButton] Could not start speech recognition:", err);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListen}
      title={isListening ? `Listening (${savedLang})… Click to stop` : `Voice Input (${savedLang})`}
      style={{
        background: isListening ? "#fee2e2" : "#f1f5f9",
        color: isListening ? "#dc2626" : "var(--accent)",
        border: isListening ? "1.5px solid #ef4444" : "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.2s ease",
        ...style,
      }}
    >
      {isListening ? (
        <>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#dc2626",
            display: "inline-block", animation: "pulse 1s infinite",
          }} />
          <Mic size={14} /> Listening…
        </>
      ) : (
        <>
          <Mic size={14} /> Speak ({savedLang.slice(0, 2)})
        </>
      )}
    </button>
  );
}
