import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Terminal, Sparkles } from 'lucide-react';

export default function AiAgentPanel({ onBookingCompleted, currentEvent }) {
  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: "Greetings, user! I am Aethera, your Agentic AI assistant. I can scan active database listings, check specific seating configurations, and directly book/confirm tickets for you. Try asking me:\n\n* *'Find a cyberpunk concert'* \n* *'Show me available seats for A.I. Uprising'* \n* *'Book seat B4 for Neon Odyssey'*",
      steps: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState('');
 const chatContainerRef = useRef(null);

useEffect(() => {
  if (!chatContainerRef.current) return;

  const container = chatContainerRef.current;

  // Only auto-scroll if the user is already near the bottom
  const nearBottom =
    container.scrollHeight -
      container.scrollTop -
      container.clientHeight <
    120;

  // While the agent is actively working (streaming reasoning steps),
  // keep following the trace log even though `messages` hasn't changed yet.
  if (nearBottom || loading) {
    // IMPORTANT: scroll only this container's own scrollbar.
    // element.scrollIntoView() walks up EVERY scrollable ancestor —
    // including the page (`body { overflow: auto }`) — so it was
    // yanking the whole page back to the top any time a new message
    // arrived while the user had scrolled down to use the seat chart.
    // container.scrollTo() only touches this element, never the page.
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }
}, [messages, activeStep, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);
    setActiveStep('Analyzing language intent...');

    const token = localStorage.getItem('token');

    try {
      const response = await fetch('https://agentic-ai-ticket-booking-4.onrender.com/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ message: userText })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Agent failed to respond');

      // Simulate steps spacing to make the Agent reasoning readable
      if (data.steps && data.steps.length > 0) {
        for (let i = 0; i < data.steps.length; i++) {
          const step = data.steps[i];
          if (step.type === 'thought') {
            setActiveStep(`🤔 Thought: ${step.content}`);
          } else if (step.type === 'tool_call') {
            setActiveStep(`🛠️ Invoking tool: ${step.name}(${JSON.stringify(step.arguments)})`);
          } else if (step.type === 'tool_result') {
            setActiveStep(`✅ Tool result returned.`);
          }
          await new Promise(r => setTimeout(r, 800));
        }
      }

      setMessages(prev => [...prev, {
        sender: 'agent',
        text: data.reply,
        steps: data.steps || []
      }]);

      if (data.actionPerformed) {
        onBookingCompleted(data.actionPerformed);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'agent',
        text: `⚠️ Direct Connection Interrupted: ${err.message}. Please check that the backend server is running correctly.`,
        steps: []
      }]);
    } finally {
      setLoading(false);
      setActiveStep('');
    }
  };

  return (
    <div className="glass-panel" style={{ height: '100%' }}>
      <div className="ai-console-header">
        <h2 className="panel-title">
          <Bot size={22} className="text-primary" style={{ color: 'var(--color-primary)' }} />
          Aethera AI Assistant
        </h2>
        <div className="ai-status-indicator">
          <span className="ai-status-pulse"></span>
          <span>Agent Online</span>
        </div>
      </div>

      <div
  ref={chatContainerRef}
  className="chat-history"
>
        {messages.map((msg, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
            {msg.sender === 'user' && (
              <div className="chat-msg user">
                {msg.text}
              </div>
            )}

            {msg.sender === 'agent' && (
              <>
                {msg.steps && msg.steps.length > 0 && (
                  <div className="reasoning-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-secondary)', fontSize: '0.75rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem', marginBottom: '0.2rem' }}>
                      <Terminal size={12} />
                      AGENTIC TRACE LOG
                    </div>
                    {msg.steps.map((step, sIdx) => (
                      <div key={sIdx} className={`reasoning-step ${step.type}`}>
                        {step.type === 'thought' && (
                          <span>🧠 [Thought] {step.content}</span>
                        )}
                        {step.type === 'tool_call' && (
                          <span>⚡ [Tool Call] {step.name}({JSON.stringify(step.arguments)})</span>
                        )}
                        {step.type === 'tool_result' && (
                          <span>📥 [Tool Result] {typeof step.data === 'object' ? `Returned ${step.data.length || 0} events` : step.data}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="chat-msg agent" style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
              </>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <div className="reasoning-box" style={{ borderColor: 'rgba(0, 255, 204, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Sparkles size={12} className="ai-status-pulse" />
                AETHERA COGNITIVE CYCLE...
              </div>
             <div
    className="reasoning-step thought"
    style={{
        position:"sticky",
        top:0,
        background:"rgba(15,18,25,.95)",
        zIndex:10
    }}
>
    {activeStep}
</div>
            </div>
            <div className="chat-msg agent" style={{ opacity: 0.6, width: 'fit-content' }}>
              Processing action loop...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="chat-input-form">
        <input
          type="text"
          className="chat-text-input"
          placeholder={currentEvent ? `Ask Aethera to book a seat for ${currentEvent.title}...` : "Scan listings, check seats, or book tickets..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.7rem' }} disabled={loading}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
