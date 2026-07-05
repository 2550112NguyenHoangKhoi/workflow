import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

export default function TeamChatWidget({ projectId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);
  const intervalRef = useRef(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('workflow_user')) || {};
    } catch {
      return {};
    }
  })();
  const myEmail = currentUser.email || '';
  const myName = currentUser.name || 'Ẩn danh';

  const baseUrl = `http://127.0.0.1:8000/api/projects/${projectId}/team_messages`;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}?after_id=${lastIdRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      const incoming = data.messages || [];
      if (!incoming.length) return;
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const fresh = incoming.filter(m => !ids.has(m.id));
        if (!fresh.length) return prev;
        return [...prev, ...fresh];
      });
      lastIdRef.current = incoming[incoming.length - 1].id;
    } catch {}
  }, [baseUrl]);

  useEffect(() => {
    if (!projectId) return;
    setMessages([]);
    lastIdRef.current = 0;
  }, [projectId]);

  useEffect(() => {
    if (!open) {
      clearInterval(intervalRef.current);
      return;
    }
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(intervalRef.current);
  }, [open, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_email: myEmail, author_name: myName, content }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const msg = data.message || data;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.id > lastIdRef.current) lastIdRef.current = msg.id;
    } catch {} finally {
      setSending(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = iso => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
  };

  if (!projectId) return null;

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 90,
          backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)',
          borderRadius: 24, padding: '10px 16px',
          boxShadow: 'var(--shadow-md)', display: 'flex', gap: 8,
          alignItems: 'center', cursor: 'pointer',
        }}
      >
        <MessageCircle size={16} color="#3B82F6" />
        <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-navy)' }}>TEAM CHAT</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No one online</span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 90,
      width: 300, height: 420, borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      backgroundColor: 'var(--bg-tertiary)',
      border: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
        borderBottom: '1px solid var(--border-light)', flexShrink: 0,
      }}>
        <MessageCircle size={18} color="#3B82F6" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-navy)', lineHeight: 1.2 }}>Team chat</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No one online</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <X size={16} color="var(--text-muted)" />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        {messages.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center',
          }}>
            <Sparkles size={28} color="#8A334C" />
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-navy)' }}>Trò chuyện nhóm</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 200, lineHeight: 1.4 }}>
              Tin nhắn trong dự án này sẽ xuất hiện trong thời gian thực.
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.author_email === myEmail;
            return (
              <div key={msg.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isOwn ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}>
                {!isOwn && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, paddingLeft: 4 }}>
                    {msg.author_name}
                  </span>
                )}
                <div style={{
                  backgroundColor: isOwn ? '#8A334C' : 'var(--bg-secondary)',
                  color: isOwn ? '#fff' : 'var(--text-navy)',
                  borderRadius: 14, padding: '8px 12px',
                  fontSize: '0.85rem', maxWidth: '80%', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px', borderTop: '1px solid var(--border-light)', flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Nhắn tin..."
          style={{
            flex: 1, border: '1px solid var(--border-light)', borderRadius: 20,
            padding: '7px 12px', fontSize: '0.85rem', outline: 'none',
            backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none',
            backgroundColor: '#8A334C', color: '#fff', cursor: sending || !input.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}