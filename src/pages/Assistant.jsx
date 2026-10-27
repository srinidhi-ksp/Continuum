import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot, Send, Mic, Volume2, VolumeX, AlertTriangle,
  Copy, Check, Volume1, RefreshCw
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { askCaregiverAssistant } from "../lib/aiApi";
import { dictionary, LANG_OPTIONS, SPEECH_LANG_MAP } from "../locales/dictionary";
import "../styles/assistant.css";

// ── Helpers ─────────────────────────────────────────────────────────────
function formatTime(date) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function uid() {
  return crypto.randomUUID();
}

// ── Component ───────────────────────────────────────────────────────────
export default function Assistant() {
  const { caregiverProfile, session } = useAuth();
  const {
    currentPatient, careCircle, coordinationMetric,
    currentMedications, currentLogs, todaysReminders
  } = usePatient();

  const [lang, setLang] = useState("en");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speechSupported] = useState(
    () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  const dict = dictionary[lang] || dictionary.en;

  // ── Speech Recognition setup ──────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = SPEECH_LANG_MAP[lang] || "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInputValue((prev) => prev + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, [lang]);

  // ── Scroll to bottom on new messages ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Build patient context payload ─────────────────────────────────────
  const buildContext = useCallback(() => {
    if (!currentPatient) return { caregiverName: caregiverProfile?.full_name || "Caregiver" };

    return {
      patientSummary: {
        name: currentPatient.name,
        condition: currentPatient.condition,
        age: currentPatient.age,
        gender: currentPatient.gender,
      },
      latestMetric: coordinationMetric || null,
      coordinationScore: coordinationMetric || null,
      careCompletion: currentPatient.careCompletion ?? 0,
      medsTaken: currentPatient.medsTaken ?? 0,
      medsTotal: currentPatient.medsTotal ?? 0,
      activeMedications: (currentMedications || [])
        .filter((m) => m.active)
        .map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
      todaysReminders: (todaysReminders || []).map((r) => ({
        title: r.title, time: r.time, status: r.status,
      })),
      recentLogs: (currentLogs || []).slice(0, 5).map((l) => ({
        type: l.type, notes: l.notes, created_at: l.created_at,
      })),
      caregivers: (careCircle || []).map((c) => ({
        name: c.name, role: c.role, active: c.status === "active",
      })),
      caregiverName: caregiverProfile?.full_name || "Caregiver",
    };
  }, [currentPatient, coordinationMetric, currentMedications, currentLogs, todaysReminders, careCircle, caregiverProfile]);

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const trimmed = (text || inputValue).trim();
    if (!trimmed || isLoading) return;

    if (isListening) recognitionRef.current?.stop();

    const userMsg = { id: uid(), role: "user", text: trimmed, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const responseText = await askCaregiverAssistant({
        message: trimmed,
        patientContext: buildContext(),
        language: lang,
        accessToken: session?.access_token,
      });

      const aiMsg = { id: uid(), role: "assistant", text: responseText, time: new Date() };
      setMessages((prev) => [...prev, aiMsg]);

      if (ttsEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = SPEECH_LANG_MAP[lang] || "en-US";
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      const errMsg = {
        id: uid(), role: "error",
        text: err.message || dict.error,
        time: new Date(),
        retryText: trimmed,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, isListening, buildContext, lang, ttsEnabled, dict.error, session]);

  // ── Retry failed message ──────────────────────────────────────────────
  const handleRetry = useCallback((retryText) => {
    // Remove the error message, then re-send
    setMessages((prev) => prev.filter((m) => m.retryText !== retryText));
    handleSend(retryText);
  }, [handleSend]);

  // ── Copy to clipboard ─────────────────────────────────────────────────
  const handleCopy = useCallback((id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // ── TTS for a single message ──────────────────────────────────────────
  const handleSpeak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_MAP[lang] || "en-US";
    window.speechSynthesis.speak(utterance);
  }, [lang]);

  // ── Toggle microphone ─────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const showWelcome = messages.length === 0;

  return (
    <div className="assistant-page">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="assistant-header">
        <div className="assistant-header__left">
          <div className="assistant-header__avatar">
            <Bot size={24} />
          </div>
          <div className="assistant-header__info">
            <h1>{dict.assistant}</h1>
            <p>{dict.subtitle}</p>
          </div>
        </div>

        <div className="assistant-header__controls">
          <select
            className="assistant-lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {LANG_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>

          <button
            className={`assistant-tts-btn ${ttsEnabled ? "active" : ""}`}
            onClick={() => {
              if (ttsEnabled) window.speechSynthesis?.cancel();
              setTtsEnabled(!ttsEnabled);
            }}
            title={ttsEnabled ? dict.stopAudio : dict.playAudio}
          >
            {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* ── Patient context strip ───────────────────────────────────────── */}
      {currentPatient ? (
        <div className="assistant-context-strip">
          <span className="assistant-context-strip__dot" />
          <span>
            <strong>{currentPatient.name}</strong>
            {currentPatient.age ? ` · ${currentPatient.age}y` : ""}
            {currentPatient.condition ? ` · ${currentPatient.condition}` : ""}
          </span>
          {coordinationMetric && (
            <>
              <span className="assistant-context-strip__divider" />
              <span>
                {dict.coordinationScore}: <strong>{coordinationMetric.score}/100</strong>
              </span>
              <span className="assistant-context-strip__divider" />
              <span>
                {dict.riskLevel}: <strong>{coordinationMetric.risk_level}</strong>
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="assistant-disclaimer">
          <AlertTriangle size={14} />
          <span>{dict.noPatient}</span>
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────── */}
      <div className="assistant-disclaimer">
        <AlertTriangle size={14} />
        <span>{dict.disclaimer}</span>
      </div>

      {/* ── Chat container ──────────────────────────────────────────────── */}
      <div className="assistant-chat">
        <div className="assistant-messages">

          {/* Welcome state */}
          {showWelcome && (
            <div className="assistant-welcome">
              <div className="assistant-welcome__icon">
                <Bot size={28} />
              </div>
              <h2>{dict.welcomeTitle}</h2>
              <p>{dict.welcomeSubtitle}</p>

              <div className="assistant-suggestions">
                {dict.suggestedQueries.map((q, i) => (
                  <button
                    key={i}
                    className="assistant-chip"
                    onClick={() => handleSend(q)}
                    disabled={isLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`assistant-msg assistant-msg--${msg.role === "user" ? "user" : msg.role === "error" ? "error" : "ai"}`}
            >
              <div className="assistant-msg__bubble">
                {msg.text}
              </div>

              <div className="assistant-msg__meta">
                <span>{formatTime(msg.time)}</span>

                {/* Actions for AI messages */}
                {msg.role === "assistant" && (
                  <div className="assistant-msg__actions">
                    <button
                      className="assistant-msg__action-btn"
                      onClick={() => handleCopy(msg.id, msg.text)}
                    >
                      {copiedId === msg.id
                        ? <><Check size={12} /> {dict.copied}</>
                        : <><Copy size={12} /> {dict.copy}</>
                      }
                    </button>
                    {window.speechSynthesis && (
                      <button
                        className="assistant-msg__action-btn"
                        onClick={() => handleSpeak(msg.text)}
                      >
                        <Volume1 size={12} /> {dict.playAudio}
                      </button>
                    )}
                  </div>
                )}

                {/* Retry for error messages */}
                {msg.role === "error" && msg.retryText && (
                  <div className="assistant-msg__actions">
                    <button
                      className="assistant-msg__action-btn"
                      onClick={() => handleRetry(msg.retryText)}
                    >
                      <RefreshCw size={12} /> {dict.errorRetry}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="assistant-typing">
              <div className="assistant-typing__dots">
                <span className="assistant-typing__dot" />
                <span className="assistant-typing__dot" />
                <span className="assistant-typing__dot" />
              </div>
              <span>{dict.thinking}</span>
            </div>
          )}

          {/* Suggestion chips after messages exist */}
          {messages.length > 0 && !isLoading && (
            <div className="assistant-suggestions" style={{ justifyContent: "flex-start" }}>
              {dict.suggestedQueries.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  className="assistant-chip"
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ────────────────────────────────────────────────── */}
        <div className="assistant-input-area">
          {speechSupported ? (
            <button
              className={`assistant-mic-btn ${isListening ? "listening" : ""}`}
              onClick={toggleMic}
              title={isListening ? dict.micOn : dict.micOff}
            >
              <Mic size={20} />
            </button>
          ) : null}

          <input
            ref={inputRef}
            type="text"
            className="assistant-input"
            placeholder={dict.typeMessage}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
          />

          <button
            className="assistant-send-btn"
            onClick={() => handleSend()}
            disabled={isLoading || !inputValue.trim()}
            title={dict.send}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
