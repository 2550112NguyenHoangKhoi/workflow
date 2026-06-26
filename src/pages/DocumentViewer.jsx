import React, { useState, useEffect, useRef } from 'react';
import { Users, Upload, ArrowRight, BrainCircuit, FileText, Sparkles } from 'lucide-react';

const DocumentViewer = () => {
  const [difficulty, setDifficulty] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/documents');
        const data = await response.json();
        setDocuments(data.documents);
        if (data.documents.length > 0) {
          setActiveDocId(data.documents[data.documents.length - 1].id);
        }
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }
    };
    fetchDocuments();
  }, []);

  const activeDoc = documents.find(d => d.id === activeDocId);

  useEffect(() => {
    if (!activeDoc) return;
    const fetchDifficulty = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/score_difficulty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_or_text: activeDoc.content })
        });
        const data = await response.json();
        setDifficulty(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDifficulty();
  }, [activeDoc]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: content }]);
    setIsTyping(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context: activeDoc ? activeDoc.content.slice(0, 6000) : ''
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.response || '...' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Không kết nối được tới máy chủ. Hãy chắc chắn backend đang chạy ở cổng 8000.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const actionPills = [
    "Tóm tắt tài liệu này",
    "Giải thích lại đơn giản",
    "Cho ví dụ thực tế",
    "Các ý chính là gì?"
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8EFEA', padding: '0' }}>

      {/* Header */}
      <div style={{ padding: '32px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <span style={{ fontSize: '1rem' }}>✧</span> THƯ VIỆN CÁ NHÂN
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#1B2A4E', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeDoc ? activeDoc.filename : "Thư viện trống"}
            {documents.length > 0 && (
              <select
                value={activeDocId || ''}
                onChange={(e) => { setActiveDocId(Number(e.target.value)); setMessages([]); }}
                style={{ fontSize: '1rem', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-medium)', color: '#1B2A4E', fontWeight: 600, outline: 'none' }}
              >
                {documents.map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{documents.length} sources attached</div>
            {difficulty && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: difficulty.level === 'Advanced' ? '#FEE2E2' : difficulty.level === 'Intermediate' ? '#FEF3C7' : '#D1FAE5',
                color: difficulty.level === 'Advanced' ? '#991B1B' : difficulty.level === 'Intermediate' ? '#92400E' : '#065F46',
                padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <BrainCircuit size={14} />
                {difficulty.level} ({difficulty.score}/10)
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
            <Users size={16} color="var(--text-secondary)" /> 1 members
          </div>
          <div style={{ display: 'flex', backgroundColor: '#EBE0D8', borderRadius: '24px', padding: '4px' }}>
            <button style={{ backgroundColor: 'transparent', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer' }}>
              Chat chính
            </button>
            <button style={{ backgroundColor: 'var(--brand-primary)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, color: 'white', fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              OmiGuide
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, padding: '24px 48px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!activeDoc ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <FileText size={48} opacity={0.5} />
              <span>Chưa có tài liệu nào. Vui lòng tải lên từ Studio.</span>
            </div>
          </div>
        ) : (
          <>
            {/* Source document card */}
            <div style={{
              backgroundColor: 'white', padding: '20px 24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)',
              color: '#1B2A4E', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', border: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--brand-primary)', marginBottom: '12px' }}>
                <FileText size={14} /> NGUỒN · {activeDoc.filename}
              </div>
              {activeDoc.content}
            </div>

            {/* Conversation thread */}
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                      <Sparkles size={12} /> OmiGuide
                    </div>
                  )}
                  <div style={{
                    backgroundColor: msg.role === 'user' ? 'var(--brand-primary)' : 'white',
                    color: msg.role === 'user' ? 'white' : '#1B2A4E',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  OmiGuide đang tra cứu tài liệu…
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div style={{ padding: '0 48px 32px' }}>
        {/* Action Pills */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          {actionPills.map(pill => (
            <button key={pill} onClick={() => sendMessage(pill)} disabled={!activeDoc || isTyping} style={{
              backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', padding: '8px 16px',
              fontSize: '0.85rem', fontWeight: 600, color: '#1B2A4E', cursor: (!activeDoc || isTyping) ? 'not-allowed' : 'pointer',
              opacity: (!activeDoc || isTyping) ? 0.5 : 1, boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              {pill}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', padding: '8px 8px 8px 16px', boxShadow: 'var(--shadow-md)' }}>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px' }}>
            <Upload size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
            placeholder="Hỏi OmiGuide hoặc yêu cầu quiz/flashcard..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', padding: '8px 12px', color: 'var(--text-primary)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{documents.length} source{documents.length === 1 ? '' : 's'}</span>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              style={{ backgroundColor: (!input.trim() || isTyping) ? 'var(--border-medium)' : 'var(--brand-primary)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: (!input.trim() || isTyping) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DocumentViewer;
