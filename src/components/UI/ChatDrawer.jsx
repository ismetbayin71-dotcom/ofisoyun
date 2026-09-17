import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react';

export const ChatDrawer = ({ messages = [], onSendMessage, playerName }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const sendQuickEmoji = (emoji) => {
    onSendMessage(emoji);
  };

  return (
    <div className={`chat-drawer ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="chat-header" onClick={() => setCollapsed(!collapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={16} color="#e5b94c" />
          <strong style={{ fontSize: '0.9rem' }}>Sohbet & Emojiler</strong>
          {collapsed && messages.length > 0 && (
            <span style={{ fontSize: '0.75rem', background: 'rgba(229, 185, 76, 0.2)', color: '#e5b94c', padding: '1px 6px', borderRadius: 999 }}>
              {messages.length}
            </span>
          )}
        </div>
        {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {/* Messages List */}
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.isSystem ? 'system' : ''}`}>
            {!m.isSystem && (
              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>
                {m.sender} <span style={{ opacity: 0.5 }}>{m.timestamp}</span>
              </div>
            )}
            <div>{m.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 8px', background: 'rgba(0,0,0,0.2)' }}>
        {['☕', '👏', '🔥', '🎲', '😂', '👋'].map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendQuickEmoji(emoji)}
            style={{ background: 'transparent', fontSize: '1.2rem', padding: '2px 6px' }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <form className="chat-input-bar" onSubmit={handleSend}>
        <input
          type="text"
          className="form-input"
          style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          placeholder="Mesaj yazın..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
