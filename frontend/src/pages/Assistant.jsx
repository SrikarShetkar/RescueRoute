import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getGeminiResponse, getProtocol, EMERGENCY_TYPES } from '../services/assistantService';
import './Assistant.css';

const Assistant = () => {
    const [messages, setMessages] = useState([
        { role: 'bot', content: 'Hello! I am your RescueRoute Emergency Assistant. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [triageStatus, setTriageStatus] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = useCallback(async (e) => {
        if (e) e.preventDefault();
        const userMsg = input.trim();
        if (!userMsg) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

        setIsTyping(true);

        const response = await getGeminiResponse(userMsg, messages);

        setIsTyping(false);
        setMessages(prev => [...prev, { role: 'bot', content: response.text }]);

        if (response.type !== EMERGENCY_TYPES.OTHER) {
            setTriageStatus(response.type);
            const protocols = getProtocol(response.type);
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    content: `I've identified this as a potential ${response.type.replace('_', ' ')}. Please follow these steps immediately:`,
                    isProtocol: true,
                    protocols: protocols
                }]);
            }, 500);
        }
    }, [input, messages]);

    const handleQuickAction = (action) => {
        setInput(action);
    };

    useEffect(() => {
        const quickActions = ['Chest Pain', 'Heavy Bleeding', 'Person Fainted'];
        if (input && quickActions.includes(input)) {
            handleSend();
        }
    }, [input, handleSend]);

    return (
        <div className="assistant-page">
            <div className="assistant-container">
                {/* Header */}
                <header className="assistant-header">
                    <div className="header-info">
                        <span className="ai-status">● LIVE</span>
                        <h1>Emergency Assistant</h1>
                        <p>AI-powered triage & first aid guidance</p>
                    </div>
                </header>

                {/* Dashboard Area (If emergency detected) */}
                {triageStatus && (
                    <div className="triage-alert-banner">
                        <div className="alert-badge">CRITICAL: {triageStatus.replace('_', ' ')}</div>
                        <p>Rescue services have been alerted to your situation.</p>
                    </div>
                )}

                {/* Chat Area */}
                <div className="chat-window">
                    <div className="messages-list">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message-wrapper ${msg.role}`}>
                                <div className="message-bubble">
                                    {msg.content}
                                    {msg.isProtocol && (
                                        <ul className="protocol-list">
                                            {msg.protocols.map((p, i) => <li key={i}>{p}</li>)}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="message-wrapper bot">
                                <div className="message-bubble typing">
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Triage Buttons */}
                    {!triageStatus && messages.length < 4 && (
                        <div className="quick-actions">
                            <button onClick={() => handleQuickAction('Chest Pain')}>Chest Pain 🫀</button>
                            <button onClick={() => handleQuickAction('Heavy Bleeding')}>Heavy Bleeding 🩸</button>
                            <button onClick={() => handleQuickAction('Person Fainted')}>Fainted 👤</button>
                        </div>
                    )}

                    {/* Input Area */}
                    <form className="assistant-input-area" onSubmit={handleSend}>
                        <textarea
                            placeholder="Type symptoms or situation here..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <button type="submit" className="send-btn" disabled={!input.trim()}>
                            ➤
                        </button>
                    </form>
                </div>

                <div className="assistant-footer">
                    <span className="disclaimer">⚠️ Disclaimer: This AI is for triage support only. Not a medical diagnosis.</span>
                </div>
            </div>
        </div>
    );
};

export default Assistant;
