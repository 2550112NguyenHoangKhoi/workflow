import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, UserPlus, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ProjectCollaborationModal from '../modals/ProjectCollaborationModal';

export default function TeamChatWidget({ projectId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('normal'); // 'normal' | 'teacher'
  const [members, setMembers] = useState([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
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
  const membersUrl = `http://127.0.0.1:8000/api/projects/${projectId}/members`;

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(membersUrl);
      if (res.ok) {
        const data = await res.json();
        const active = data.active || [];
        const hasOwner = active.some(m => m.role && m.role.toLowerCase() === 'owner');
        if (!hasOwner) {
          const ownerEmail = currentUser?.email || 'owner@local.app';
          active.unshift({ email: ownerEmail, role: 'owner' });
        }
        setMembers(active);
      }
    } catch (err) {}
  }, [projectId, membersUrl]);

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

  const fetchAiMessages = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setAiMessages(data.messages || []);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setMessages([]);
    setAiMessages([]);
    lastIdRef.current = 0;
    fetchMembers();
  }, [projectId, fetchMembers]);

  useEffect(() => {
    if (!open) {
      clearInterval(intervalRef.current);
      return;
    }
    fetchMessages();
    fetchAiMessages();
    fetchMembers();
    intervalRef.current = setInterval(() => {
      fetchMessages();
      fetchAiMessages();
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, [open, fetchMessages, fetchAiMessages, fetchMembers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiMessages, activeTab]);

  const send = async (overrideContent = null) => {
    const content = overrideContent || input.trim();
    if (!content || sending) return;
    setSending(true);
    if (!overrideContent) setInput('');
    
    if (activeTab === 'teacher') {
      try {
        const payload = {
          project_id: projectId,
          role: "user",
          content: content,
          persona: "Giáo viên"
        };
        const tempId = Date.now();
        setAiMessages(prev => [...prev, { id: tempId, role: 'user', content, created_at: new Date().toISOString() }]);

        const res = await fetch(`http://127.0.0.1:8000/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
           await fetchAiMessages();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSending(false);
      }
      return;
    }

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

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  };

  const avatarColors = [
    { bg: '#22C55E', text: '#FFFFFF' }, 
    { bg: '#8B5CF6', text: '#FFFFFF' }, 
    { bg: '#F87171', text: '#FFFFFF' }, 
    { bg: '#3B82F6', text: '#FFFFFF' }, 
    { bg: '#F59E0B', text: '#FFFFFF' }, 
  ];

  const parseMessageContent = (content) => {
    if (!content) return { text: '', card: null };
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = content.match(jsonRegex);
    if (match) {
      try {
        const cardData = JSON.parse(match[1]);
        const text = content.replace(jsonRegex, '').trim();
        return { text, card: cardData };
      } catch {
        return { text: content, card: null };
      }
    }
    return { text: content, card: null };
  };

  const McqCard = ({ card }) => {
    const [answer, setAnswer] = useState('');
    return (
      <div style={{ 
        marginTop: '8px', border: '1px solid #D6C5B3', borderRadius: '12px', 
        padding: '12px', backgroundColor: '#FAFAF9', color: '#1F2937'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ padding: '4px', backgroundColor: '#F0E6D2', borderRadius: '6px', color: '#8A334C' }}>
            <Layers size={16} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#8A334C' }}>MCQ</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '12px' }}>
          {card?.question || "Ý chính cần hiểu về 'Chủ đề hiện tại' là gì?"}
        </div>
        <textarea 
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Nhập câu trả lời..."
          style={{
            width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D6C5B3',
            backgroundColor: '#FAFAF9', resize: 'vertical', minHeight: '60px', marginBottom: '12px',
            outline: 'none', fontSize: '0.85rem', color: '#4B5563', boxSizing: 'border-box'
          }}
        />
        <button 
          onClick={() => { if(answer.trim()) send(answer); }}
          style={{
            padding: '8px 16px', backgroundColor: '#D6C5B3', color: '#FFFFFF',
            border: 'none', borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Nộp
        </button>
      </div>
    );
  };

  const renderSuggestedActions = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
      {['Tạo câu nữa', 'Giải thích đáp án', 'Tạo flashcard'].map(act => (
        <button key={act} onClick={() => send(act)} style={{
          padding: '6px 12px', borderRadius: '16px', border: '1px solid #D6C5B3',
          backgroundColor: '#FFFFFF', color: '#8A334C', fontSize: '0.8rem', fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap'
        }}>{act}</button>
      ))}
    </div>
  );

  const activeMessages = activeTab === 'normal' ? messages : aiMessages;

  if (!projectId) return null;

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 90,
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: '#007AFF', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(0, 122, 255, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'transform 0.2s'
          }}
        >
          <MessageCircle size={28} />
        </button>
      ) : (
        <>
          <div style={{
            position: 'fixed', bottom: 30, right: 30, zIndex: 90,
            width: 360, height: 540, borderRadius: 24,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            backgroundColor: '#FFFFFF',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1F2937' }}>
                  {activeTab === 'teacher' ? 'AI giáo viên' : 'Nhóm học tập'}
                </div>
                <div style={{ display: 'flex', marginLeft: '4px' }}>
                  {members.slice(0, 3).map((m, i) => {
                    const color = avatarColors[i % avatarColors.length];
                    const name = currentUser?.email === m.email ? currentUser.name : m.email.split('@')[0];
                    return (
                      <div key={i} style={{
                        width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color.bg,
                        color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 700, marginLeft: i > 0 ? '-8px' : '0',
                        border: '2px solid white'
                      }}>
                        {getInitials(name)}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  style={{ 
                    background: 'none', border: 'none', color: '#007AFF', 
                    fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                    cursor: 'pointer' 
                  }}
                >
                  <UserPlus size={14} /> Mời bạn
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ 
                    background: '#F3F4F6', border: 'none', cursor: 'pointer', 
                    width: '28px', height: '28px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}
                >
                  <X size={14} color="#6B7280" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', backgroundColor: '#F3F4F6', borderRadius: '24px', padding: '4px' }}>
                <button
                  onClick={() => setActiveTab('normal')}
                  style={{
                    flex: 1, padding: '8px 0', border: 'none', borderRadius: '20px',
                    backgroundColor: activeTab === 'normal' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'normal' ? '#007AFF' : '#6B7280',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    boxShadow: activeTab === 'normal' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Chat thường
                </button>
                <button
                  onClick={() => setActiveTab('teacher')}
                  style={{
                    flex: 1, padding: '8px 0', border: 'none', borderRadius: '20px',
                    backgroundColor: activeTab === 'teacher' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'teacher' ? '#007AFF' : '#6B7280',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    boxShadow: activeTab === 'teacher' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Học với giáo viên
                </button>
              </div>
            </div>

            {/* AI Action Pills (Teacher mode only) */}
            {activeTab === 'teacher' && (
              <div style={{ 
                display: 'flex', gap: '8px', padding: '12px 20px', 
                borderBottom: '1px solid #F3F4F6', overflowX: 'auto', whiteSpace: 'nowrap' 
              }}>
                {['Quiz', 'Flashcard', 'Tự luận'].map(act => (
                  <button key={act} onClick={() => {
                    const promptText = `Tạo một ${act.toLowerCase()} dưới dạng JSON có cấu trúc: \`\`\`json { "type": "mcq", "question": "...", "options": ["..."] } \`\`\` và giải thích ngắn gọn.`;
                    send(promptText);
                  }} style={{
                    padding: '6px 16px', borderRadius: '20px', border: '1px solid #D6C5B3',
                    backgroundColor: '#FFFFFF', color: '#8A334C', fontSize: '0.85rem', fontWeight: 600,
                    cursor: 'pointer'
                  }}>{act}</button>
                ))}
              </div>
            )}

            {/* Members List Bar */}
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', 
              padding: '12px 20px', borderBottom: '1px solid #F3F4F6',
              overflowX: 'auto', whiteSpace: 'nowrap' 
            }}>
              <span style={{ fontSize: '0.8rem', color: '#9CA3AF', fontWeight: 600 }}>Thành viên:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {members.map((m, i) => {
                  const color = avatarColors[i % avatarColors.length];
                  const name = currentUser?.email === m.email ? currentUser.name : m.email.split('@')[0];
                  return (
                    <div key={i} style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', 
                      padding: '4px 10px 4px 4px', borderRadius: '16px', border: '1px solid #E5E7EB' 
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: color.bg,
                        color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 700
                      }}>
                        {getInitials(name)}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4B5563' }}>{name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', backgroundColor: '#FAFAFA' }}>
              {activeMessages.length === 0 ? (
                <div style={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F2937' }}>Bắt đầu trò chuyện</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', maxWidth: 200, marginTop: '4px' }}>
                    {activeTab === 'teacher' ? 'Hỏi giáo viên AI bất kỳ điều gì.' : 'Hãy là người đầu tiên nhắn tin trong nhóm này.'}
                  </div>
                </div>
              ) : (
                activeMessages.map(msg => {
                  const isOwn = activeTab === 'teacher' ? (msg.role === 'user') : (msg.author_email === myEmail);
                  const name = activeTab === 'teacher' ? (isOwn ? myName : 'Giáo viên') : (isOwn ? myName : msg.author_name);
                  const initial = getInitials(name);
                  // Quick hash to get consistent color for user
                  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  const color = activeTab === 'teacher' && !isOwn ? {bg: '#8A334C', text: '#FFFFFF'} : avatarColors[hash % avatarColors.length];

                  let textContent = msg.content;
                  let cardData = null;
                  
                  if (activeTab === 'teacher' && !isOwn) {
                    const parsed = parseMessageContent(msg.content);
                    textContent = parsed.text;
                    cardData = parsed.card;
                  }

                  return (
                    <div key={msg.id || msg.created_at} style={{
                      display: 'flex', gap: '8px',
                      flexDirection: isOwn ? 'row-reverse' : 'row',
                      marginBottom: '16px',
                    }}>
                      {!isOwn && (
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', backgroundColor: color.bg,
                          color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: '4px'
                        }}>
                          {initial}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        {!isOwn && (
                          <span style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: '4px', marginLeft: '4px' }}>
                            {name}
                          </span>
                        )}
                        <div style={{
                          backgroundColor: isOwn ? '#8A334C' : '#E5E7EB',
                          color: isOwn ? '#FFFFFF' : '#1F2937',
                          borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                          padding: '10px 14px',
                          fontSize: '0.9rem', wordBreak: 'break-word',
                        }}>
                          <ReactMarkdown components={{ p: ({node, ...props}) => <p style={{ margin: 0, padding: 0, marginBottom: '4px' }} {...props} /> }}>
                            {textContent}
                          </ReactMarkdown>
                          {cardData && cardData.type === 'mcq' && <McqCard card={cardData} />}
                        </div>
                        {activeTab === 'teacher' && !isOwn && renderSuggestedActions()}
                        <span style={{ fontSize: '0.65rem', color: '#9CA3AF', marginTop: '4px' }}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #F3F4F6', backgroundColor: '#FFFFFF', flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: '#F3F4F6', borderRadius: '24px', padding: '6px 16px',
                border: activeTab === 'teacher' ? '1px solid #D6C5B3' : 'none'
              }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Nhắn tin..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', color: '#1F2937',
                    fontSize: '0.9rem', outline: 'none', padding: '8px 0'
                  }}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  style={{
                    background: 'none', border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: input.trim() && !sending ? '#007AFF' : '#9CA3AF'
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 91,
              width: 56, height: 56, borderRadius: '50%',
              backgroundColor: '#007AFF', color: 'white', border: 'none',
              boxShadow: '0 4px 12px rgba(0, 122, 255, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'transform 0.2s'
            }}
          >
            <X size={28} />
          </button>
        </>
      )}

      {/* Render the modal */}
      <ProjectCollaborationModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        projectId={projectId} 
        members={members}
        onInviteSuccess={fetchMembers}
      />
    </>
  );
}