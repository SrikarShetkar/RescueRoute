import React, { useState, useEffect, useRef, useCallback } from "react";
import { getGeminiResponse, getProtocol, EMERGENCY_TYPES } from "../services/assistantService";
import Icon from "./Icon";
import "./shared.css";

/**
 * AiFirstAid — the AI first-aid chat embedded inside a screen (not a separate
 * page, per the design rules). Quick triage before/while help arrives.
 */
export default function AiFirstAid() {
  const [messages, setMessages] = useState([
    { role: "bot", content: "Hi, I'm your RescueRoute first-aid assistant. Describe what happened and I'll guide you until help arrives." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);

  const scroll = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scroll();
  }, [messages, isTyping]);

  const send = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isTyping) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setIsTyping(true);
    const response = await getGeminiResponse(trimmed, messages);
    setIsTyping(false);
    setMessages((m) => [...m, { role: "bot", content: response.text }]);
    if (response.type !== EMERGENCY_TYPES.OTHER && response.type !== "GREETING") {
      const protocols = getProtocol(response.type);
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          { role: "bot", content: `Likely ${response.type.replace("_", " ").toLowerCase()}. First-aid steps:`, isProtocol: true, protocols },
        ]);
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, messages, isTyping]);

  const quick = [
  { label: "Chest pain", icon: "heart" },
  { label: "Heavy bleeding", icon: "blood" },
  { label: "Person fainted", icon: "user" },
];

  return (
    <div className="ai-chat card">
      <div className="ai-chat-head">
        <span className="ai-status-dot" />
        <strong>AI First-Aid Assistant</strong>
        <span className="muted">(triage guidance only)</span>
      </div>

      <div className="ai-note">
        <Icon name="shield" size={13} />
        <span>
          Privacy: only the symptoms you type here are sent to the AI. Blood group, allergies
          and emergency contact never leave the server.
        </span>
      </div>

      <div className="ai-chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-bubble">
              {m.content}
              {m.isProtocol && (
                <ol className="ai-protocol">
                  {m.protocols.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ))}
        {isTyping && <div className="ai-msg bot"><div className="ai-bubble ai-typing">…</div></div>}
        <div ref={endRef} />
      </div>

      <div className="ai-quick">
        {quick.map((q) => (
          <button key={q.label} className="btn btn-ghost" onClick={() => send(q.label)}>
            <Icon name={q.icon} size={13} /> {q.label}
          </button>
        ))}
      </div>

      <form
        className="ai-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe symptoms or the situation…"
        />
        <button className="btn btn-blue" type="submit" disabled={!input.trim()}>
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}