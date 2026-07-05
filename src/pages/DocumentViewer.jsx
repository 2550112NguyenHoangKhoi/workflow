import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useOutletContext } from 'react-router-dom';
import { Users, ArrowRight, BrainCircuit, FileText, Sparkles, MessageCircle, Settings, FileSearch, PenTool, LayoutTemplate, Briefcase, Languages, Network } from 'lucide-react';
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
      context: activeDoc ? activeDoc.content.slice(0, 6000) : '',
      persona: chatMode === 'omiguide' ? selectedPersona : null
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

  const actionPills = [
    "Tạo quiz nhanh",
    "Tạo flashcard",
    "Giải thích lại",
    "Cho ví dụ"
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8EFEA', padding: '0' }}>

      {/* Header */}
      <div style={{ padding: '32px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <span style={{ fontSize: '1rem' }}>✧</span> THƯ VIỆN CÁ NHÂN
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeDoc ? activeDoc.filename : "Thư viện trống"}
            {documents.length > 0 && (
              <select
                value={activeDocId || ''}
                onChange={(e) => { setActiveDocId(Number(e.target.value)); setMessages([]); }}
                style={{ fontSize: '1rem', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-medium)', color: 'var(--text-navy)', fontWeight: 600, outline: 'none' }}
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
            <div style={{ flex: 1, borderRight: '1px solid var(--border-medium)', overflowY: 'auto', padding: '24px 48px', backgroundColor: '#FDF8F5' }}>
              {!activeDoc ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <FileText size={48} opacity={0.5} />
                    <span>Chưa có tài liệu nào. Vui lòng tải lên tài liệu mới.</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--brand-primary)', marginBottom: '12px' }}>
                    <FileText size={14} /> NGUỒN · {activeDoc.filename}
                  </div>
                  {activeDoc.has_file && activeDoc.filename.toLowerCase().endsWith('.pdf') ? (
                    <div style={{ flex: 1, position: 'relative', minHeight: '600px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', border: '1px solid var(--border-medium)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PDF Viewer</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <a href={`http://127.0.0.1:8000/api/documents/${activeDoc.id}/file`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Mở trong tab mới ↗
                          </a>
                          <button onClick={() => setIsExamModalOpen(true)} style={{ backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                            <Sparkles size={16} /> Tạo đề thi ngay
                          </button>
                        </div>
                      </div>
                      <PdfViewer url={`http://127.0.0.1:8000/api/documents/${activeDoc.id}/file`} />
                    </div>
                  ) : (
                    <div className="markdown-body" style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-medium)' }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {activeDoc.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        {/* Right Pane / Full Chat */}
        <div style={{ width: (isProjectRoute && !activeDoc) ? '100%' : '450px', display: 'flex', flexDirection: 'column', backgroundColor: '#FAFAF9', position: 'relative' }}>
          
          {/* Chat Panel */}
          <>
              {/* Chat mode toggle — Chat chính (plain AI) vs OmiGuide (persona tutor) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px 0' }}>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#E5E7EB', padding: '4px', borderRadius: '24px' }}>
                  {[['main', 'Chat chính'], ['omiguide', 'OmiGuide']].map(([mode, label]) => (
                    <button key={mode} onClick={() => setChatMode(mode)} style={{
                      backgroundColor: chatMode === mode ? 'var(--brand-primary)' : 'transparent',
                      border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '0.8rem',
                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      color: chatMode === mode ? 'white' : '#6B7280',
                      boxShadow: chatMode === mode ? 'var(--shadow-sm)' : 'none'
                    }}>{label}</button>
                  ))}
                </div>
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
                        ? 'OmiGuide dạy kèm theo persona đã chọn trong Studio, bám sát giáo án.'
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#8A334C', marginBottom: '8px' }}>
                          <Sparkles size={14} /> Workflow
                        </div>
                      )}
                      <div style={{
                        backgroundColor: msg.role === 'user' ? '#8A334C' : 'white',
                        color: msg.role === 'user' ? 'white' : '#1F2937',
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
              <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FAFAF9' }}>
                {/* Action Pills — sends prompt directly to chat like Workflow */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {actionPills.map(pill => (
                    <button key={pill} onClick={() => sendMessage(pill)} disabled={!activeDoc || isTyping} style={{
                      backgroundColor: 'var(--bg-tertiary)', border: '1px solid #D6C5B3', borderRadius: '20px', padding: '6px 14px',
                      fontSize: '0.8rem', fontWeight: 600, color: '#1F2937', cursor: (!activeDoc || isTyping) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap', opacity: (!activeDoc || isTyping) ? 0.5 : 1, transition: 'all 0.2s'
                    }}>
                      {pill}
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
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', padding: '4px', color: '#1F2937' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isTyping}
                    style={{ backgroundColor: (!input.trim() || isTyping) ? '#E5E7EB' : '#D6C5B3', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: (!input.trim() || isTyping) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
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
