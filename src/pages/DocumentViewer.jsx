import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useOutletContext } from 'react-router-dom';
import { Users, ArrowRight, BrainCircuit, FileText, Sparkles, PanelRightClose, PanelRightOpen, ExternalLink } from 'lucide-react';
import PdfViewer from '../components/PdfViewer';
import ProjectCollaborationModal from '../components/modals/ProjectCollaborationModal';
import CreateExamModal from '../components/modals/CreateExamModal';
import ConceptMapModal from '../components/modals/ConceptMapModal';
import FlashcardReviewModal from '../components/modals/FlashcardReviewModal';
import CreateStudyDocModal from '../components/modals/CreateStudyDocModal';
import CreateLessonPlanModal from '../components/modals/CreateLessonPlanModal';
import SmartNotesModal from '../components/modals/SmartNotesModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { getEngineKey } from '../utils/engine';

const DocumentViewer = () => {
  const { id } = useParams();
  const location = useLocation();
  const isProjectRoute = location.pathname.startsWith('/project/');

  const context = useOutletContext();
  const selectedPersona = context?.selectedPersona || 'Gia sư thân thiện';
  const [difficulty, setDifficulty] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [isConceptMapOpen, setIsConceptMapOpen] = useState(false);
  const [isStudyDocOpen, setIsStudyDocOpen] = useState(false);
  const [isLessonPlanOpen, setIsLessonPlanOpen] = useState(false);
  const [isSmartNotesOpen, setIsSmartNotesOpen] = useState(false);


  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // 'omiguide' = persona-driven tutor; 'main' = plain AI chat (no persona prompt).
  const [chatMode, setChatMode] = useState('omiguide');
  const threadEndRef = useRef(null);
  // Chat column: resizable (drag the divider) and collapsible so the source can use the
  // whole width. It used to be a fixed 450px, which left a PDF ~90px wide on a laptop.
  const readNum = (k, d) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } };
  const [chatWidth, setChatWidth] = useState(() => readNum('workflow_chat_width', 380));
  const [chatHidden, setChatHidden] = useState(() => { try { return localStorage.getItem('workflow_chat_hidden') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('workflow_chat_width', String(chatWidth)); localStorage.setItem('workflow_chat_hidden', chatHidden ? '1' : '0'); } catch { /* storage off */ } }, [chatWidth, chatHidden]);
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX, startW = chatWidth;
    const move = (ev) => setChatWidth(Math.min(720, Math.max(300, startW - (ev.clientX - startX))));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Fetch documents with filtering if project route
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        let url = 'http://127.0.0.1:8000/api/documents';
        if (isProjectRoute && id) {
          url += `?project_id=${id}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        setDocuments(data.documents);
        
        if (data.documents && data.documents.length > 0) {
          if (!isProjectRoute && id) {
            const matchedDoc = data.documents.find(d => String(d.id) === String(id));
            setActiveDocId(matchedDoc ? matchedDoc.id : data.documents[data.documents.length - 1].id);
          } else {
            setActiveDocId(data.documents[data.documents.length - 1].id);
          }
        } else {
          setActiveDocId(null);
        }
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }
    };
    fetchDocuments();
  }, [id, isProjectRoute]);

  // Store active document ID in sessionStorage
  useEffect(() => {
    if (activeDocId) {
      sessionStorage.setItem('active_document_id', String(activeDocId));
    } else {
      sessionStorage.removeItem('active_document_id');
    }
  }, [activeDocId]);

  const activeDoc = documents.find(d => d.id === activeDocId);
  const currentProjectId = isProjectRoute ? id : (activeDoc ? activeDoc.project_id : null);

  // Fetch chat history
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!id) {
        setMessages([]);
        return;
      }
      try {
        const url = isProjectRoute
          ? `http://127.0.0.1:8000/api/projects/${id}/messages`
          : `http://127.0.0.1:8000/api/documents/${id}/messages`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const formatted = data.messages.map(m => ({
            role: m.role,
            text: m.content
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };
    fetchChatHistory();
  }, [id, isProjectRoute, activeDocId]);

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
    
    // Construct the contextual payload
    const payload = {
      message: content,
      // The backend loads the full document/project text itself from the ids below.
      context: '',
      persona: chatMode === 'omiguide' ? selectedPersona : null,
      api_key: getEngineKey()
    };
    
    if (isProjectRoute && id) {
      payload.project_id = Number(id);
      if (activeDocId) {
        payload.document_id = Number(activeDocId);
      }
    } else if (!isProjectRoute && id) {
      payload.document_id = Number(id);
      if (activeDoc && activeDoc.project_id) {
        payload.project_id = Number(activeDoc.project_id);
      }
    } else {
      if (activeDocId) {
        payload.document_id = Number(activeDocId);
      }
      if (activeDoc && activeDoc.project_id) {
        payload.project_id = Number(activeDoc.project_id);
      }
    }
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  // A page jump requested before navigating here (mind map node in another document).
  const pendingPage = (docId) => {
    try {
      const g = JSON.parse(sessionStorage.getItem('pdf_goto') || 'null');
      if (g && Number(g.docId) === Number(docId)) { sessionStorage.removeItem('pdf_goto'); return g.page; }
    } catch { /* storage off */ }
    return undefined;
  };

  // "Hỏi AI về mục này" from the mind map (and text selected in the PDF) lands in this chat.
  const sendRef = useRef(null);
  sendRef.current = sendMessage;
  useEffect(() => {
    const onAsk = (e) => { if (e.detail?.text) { setChatHidden(false); sendRef.current(e.detail.text); } };
    window.addEventListener('chat-ask', onAsk);
    return () => window.removeEventListener('chat-ask', onAsk);
  }, []);

  // Quiz/flashcard pills open the real generators; the others are chat prompts.
  // Sources the chat actually uses: the whole project on a project page; otherwise the
  // selected document plus its project's other documents (it used to count the whole library).
  const attachedCount = isProjectRoute
    ? documents.length
    : activeDoc
      ? (activeDoc.project_id ? documents.filter(d => d.project_id === activeDoc.project_id).length : 1)
      : 0;

  const actionPills = [
    { label: "Tạo quiz nhanh", action: () => setIsExamModalOpen(true) },
    { label: "Tạo flashcard", action: () => setIsFlashcardOpen(true) },
    { label: "Giải thích lại", action: () => sendMessage("Giải thích lại") },
    { label: "Cho ví dụ", action: () => sendMessage("Cho ví dụ") }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--surface-blush)', padding: '0' }}>

      {/* Header */}
      <div style={{ padding: '14px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <span style={{ fontSize: '1rem' }}>✧</span> THƯ VIỆN CÁ NHÂN
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', wordBreak: 'break-word' }}>
            {activeDoc ? activeDoc.filename : "Thư viện trống"}
            {documents.length > 0 && (
              <select
                value={activeDocId || ''}
                onChange={(e) => { setActiveDocId(Number(e.target.value)); setMessages([]); }}
                style={{ fontSize: '0.85rem', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-medium)', color: 'var(--text-navy)', backgroundColor: 'var(--bg-tertiary)', fontWeight: 600, outline: 'none', maxWidth: '260px' }}
              >
                {documents.map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{attachedCount} {attachedCount === 1 ? 'source' : 'sources'} attached</div>
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
          <button 
            onClick={() => setIsCollabOpen(true)}
            style={{ 
              backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '20px', 
              padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px', 
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-navy)' 
            }}
          >
            <Users size={16} color="var(--brand-primary)" /> 1 members
          </button>
        </div>
      </div>

      <ProjectCollaborationModal isOpen={isCollabOpen} onClose={() => setIsCollabOpen(false)} projectId={currentProjectId} documentId={!isProjectRoute && activeDoc ? activeDoc.id : null} />

      {/* Main Content Area: Split View */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {(!isProjectRoute || activeDoc) && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0 12px 12px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
              {!activeDoc ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <FileText size={48} opacity={0.5} />
                    <span>Chưa có tài liệu nào. Vui lòng tải lên tài liệu mới.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 4px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--brand-primary)', minWidth: 0, flex: '1 1 160px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <FileText size={14} style={{ flexShrink: 0 }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>NGUỒN · {activeDoc.filename}</span>
                    </div>
                    {activeDoc.has_file && (
                      <a href={`http://127.0.0.1:8000/api/documents/${activeDoc.id}/file`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        <ExternalLink size={13} /> Mở tab mới
                      </a>
                    )}
                    <button onClick={() => setIsExamModalOpen(true)} style={{ backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <Sparkles size={14} /> Tạo đề thi ngay
                    </button>
                    {chatHidden && (
                      <button onClick={() => setChatHidden(false)} title="Hiện khung chat" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', border: '1px solid var(--border-medium)', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <PanelRightOpen size={14} /> Chat
                      </button>
                    )}
                  </div>
                  {activeDoc.has_file && activeDoc.filename.toLowerCase().endsWith('.pdf') ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
                      <PdfViewer url={`http://127.0.0.1:8000/api/documents/${activeDoc.id}/file`} docId={activeDoc.id} initialPage={pendingPage(activeDoc.id)} />
                    </div>
                  ) : (
                    <div className="markdown-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)', padding: '24px 32px', borderRadius: '12px', border: '1px solid var(--border-medium)' }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {activeDoc.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {(!isProjectRoute || activeDoc) && !chatHidden && (
            <div onMouseDown={startResize} role="separator" aria-orientation="vertical" title="Kéo để đổi độ rộng khung chat"
              style={{ width: '6px', cursor: 'col-resize', flexShrink: 0, backgroundColor: 'var(--border-light)', borderLeft: '1px solid var(--border-medium)' }} />
          )}
        {/* Right Pane / Full Chat */}
        <div style={{ width: (isProjectRoute && !activeDoc) ? '100%' : `${chatWidth}px`, flexShrink: 0, display: (chatHidden && !(isProjectRoute && !activeDoc)) ? 'none' : 'flex', flexDirection: 'column', backgroundColor: 'var(--surface-plain)', position: 'relative' }}>
          
          {/* Chat Panel */}
          <>
              {/* Chat mode toggle — Chat chính (plain AI) vs Gia sư (persona tutor) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px 16px 0' }}>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--surface-grey)', padding: '4px', borderRadius: '24px' }}>
                  {[['main', 'Chat chính'], ['omiguide', 'Gia sư AI']].map(([mode, label]) => (
                    <button key={mode} onClick={() => setChatMode(mode)} style={{
                      backgroundColor: chatMode === mode ? 'var(--brand-primary)' : 'transparent',
                      border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '0.8rem',
                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      color: chatMode === mode ? 'white' : '#6B7280',
                      boxShadow: chatMode === mode ? 'var(--shadow-sm)' : 'none'
                    }}>{label}</button>
                  ))}
                </div>
                {activeDoc && (
                  <button onClick={() => setChatHidden(true)} title="Ẩn khung chat (xem tài liệu toàn bộ chiều rộng)" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
                    <PanelRightClose size={18} />
                  </button>
                )}
              </div>
              {/* Chat Messages */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(isProjectRoute && !activeDoc && messages.length === 0) && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--brand-primary)' }}>WORKFLOW AI</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>0 sources attached</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>No roadmap yet</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '420px', textAlign: 'center', margin: 0 }}>
                      {chatMode === 'omiguide'
                        ? 'Gia sư AI dạy kèm theo persona đã chọn trong Studio, bám sát giáo án.'
                        : 'Chat chính hỏi đáp trực tiếp với AI trên nguồn tài liệu của dự án.'}
                    </p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}>
                      {msg.role === 'assistant' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: '8px' }}>
                          <Sparkles size={14} /> Workflow
                        </div>
                      )}
                      <div style={{
                        backgroundColor: msg.role === 'user' ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                        color: msg.role === 'user' ? 'white' : 'var(--text-ink)',
                        border: msg.role === 'user' ? 'none' : '1px solid #E5E7EB',
                        padding: '12px 16px',
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '12px',
                        fontSize: '0.95rem', lineHeight: 1.6,
                        boxShadow: msg.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                        overflowX: 'auto',
                        width: msg.role === 'user' ? 'auto' : '100%'
                      }}>
                        {msg.role === 'user' ? (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                        ) : (
                          <div className="markdown-body">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {/* Inline Action Pills for AI messages */}
                      {msg.role === 'assistant' && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Bắt đầu hỏi mình', action: () => sendMessage('Bắt đầu hỏi mình về nội dung này') },
                            { label: 'Tạo quiz nhanh', action: () => setIsExamModalOpen(true) },
                            { label: 'Tạo flashcard', action: () => setIsFlashcardOpen(true) }
                          ].map(pill => (
                            <button key={pill.label} onClick={pill.action} style={{
                              backgroundColor: 'var(--bg-tertiary)', border: '1px solid #D6C5B3', borderRadius: '20px',
                              padding: '5px 14px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-navy)',
                              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                            }}>
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                      Workflow đang suy nghĩ...
                    </div>
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>
              {/* Chat Input */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', backgroundColor: 'var(--surface-plain)' }}>
                {/* Action Pills — sends prompt directly to chat like Workflow */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {actionPills.map(pill => (
                    <button key={pill.label} onClick={pill.action} disabled={!activeDoc || isTyping} style={{
                      backgroundColor: 'var(--bg-tertiary)', border: '1px solid #D6C5B3', borderRadius: '20px', padding: '6px 14px',
                      fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-ink)', cursor: (!activeDoc || isTyping) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap', opacity: (!activeDoc || isTyping) ? 0.5 : 1, transition: 'all 0.2s'
                    }}>
                      {pill.label}
                    </button>
                  ))}
                </div>
                {/* Input Bar */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '24px', border: '1px solid #D6C5B3', display: 'flex', alignItems: 'center', padding: '6px 6px 6px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                    placeholder="Hỏi Workflow..."
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', padding: '4px', color: 'var(--text-ink)' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isTyping}
                    style={{ backgroundColor: (!input.trim() || isTyping) ? 'var(--surface-grey)' : '#D6C5B3', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: (!input.trim() || isTyping) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </>
        </div>
      </div>
      <CreateExamModal isOpen={isExamModalOpen} onClose={() => setIsExamModalOpen(false)} projectId={currentProjectId} documentId={!isProjectRoute && activeDoc ? activeDoc.id : null} onSuccess={() => window.dispatchEvent(new Event('artifacts-updated'))} />
      <ConceptMapModal isOpen={isConceptMapOpen} onClose={() => setIsConceptMapOpen(false)} />
      <FlashcardReviewModal isOpen={isFlashcardOpen} onClose={() => setIsFlashcardOpen(false)} projectId={currentProjectId} documentId={!isProjectRoute && activeDoc ? activeDoc.id : null} />
      <CreateStudyDocModal isOpen={isStudyDocOpen} onClose={() => setIsStudyDocOpen(false)} projectId={currentProjectId} documentId={!isProjectRoute && activeDoc ? activeDoc.id : null} onSuccess={() => window.dispatchEvent(new Event('artifacts-updated'))} />
      <CreateLessonPlanModal isOpen={isLessonPlanOpen} onClose={() => setIsLessonPlanOpen(false)} projectId={currentProjectId} documentId={!isProjectRoute && activeDoc ? activeDoc.id : null} onSuccess={() => window.dispatchEvent(new Event('artifacts-updated'))} />
      <SmartNotesModal isOpen={isSmartNotesOpen} onClose={() => setIsSmartNotesOpen(false)} />
    </div>
  );
};

export default DocumentViewer;
