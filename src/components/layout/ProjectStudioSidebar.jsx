import React, { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Check, MoreVertical, Search, Upload, Calendar, MessageCircle, AlertCircle, FileText, Network, BrainCircuit, Share2, Users } from 'lucide-react';
import UploadSourcesModal from '../modals/UploadSourcesModal';
import SearchMaterialsModal from '../modals/SearchMaterialsModal';
import CreateExamModal from '../modals/CreateExamModal';
import ConceptMapModal from '../modals/ConceptMapModal';
import FlashcardReviewModal from '../modals/FlashcardReviewModal';
import StudyPlanModal from '../modals/StudyPlanModal';
import CreateLessonPlanModal from '../modals/CreateLessonPlanModal';
import ArtifactViewerModal from '../modals/ArtifactViewerModal';

const ProjectStudioSidebar = ({ selectedPersona, setSelectedPersona }) => {
  const { id } = useParams();
  const location = useLocation();
  const isProject = location.pathname.startsWith('/project/');
  const projectId = isProject ? id : null;
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [isConceptMapOpen, setIsConceptMapOpen] = useState(false);
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [isStudyPlanOpen, setIsStudyPlanOpen] = useState(false);
  const [isCreateLessonPlanOpen, setIsCreateLessonPlanOpen] = useState(false);
  const [viewArtifactId, setViewArtifactId] = useState(null);

  const [roadmapItems, setRoadmapItems] = useState([]);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [documents, setDocuments] = useState([]);

  const fetchData = async () => {
    try {
      if (isProject && projectId) {
        const [rRes, aRes, pRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/projects/${projectId}/roadmap`),
          fetch(`http://127.0.0.1:8000/api/projects/${projectId}/artifacts`),
          fetch(`http://127.0.0.1:8000/api/projects/${projectId}`)
        ]);
        if (rRes.ok) {
          const data = await rRes.json();
          setRoadmapItems(data.items || []);
        }
        if (aRes.ok) {
          const data = await aRes.json();
          setArtifacts(data || []);
        }
        if (pRes.ok) {
          const data = await pRes.json();
          setDocuments(data.documents || []);
        }
      } else if (id) {
        // Standalone Document Mode
        const [rRes, aRes, pRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/documents/${id}/roadmap`),
          fetch(`http://127.0.0.1:8000/api/documents/${id}/artifacts`),
          fetch(`http://127.0.0.1:8000/api/documents`)
        ]);
        if (rRes.ok) {
          const data = await rRes.json();
          setRoadmapItems(data.items || []);
        }
        if (aRes.ok) {
          const data = await aRes.json();
          setArtifacts(data || []);
        }
        if (pRes.ok) {
          const data = await pRes.json();
          setDocuments(data.documents || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [id, isProject]);

  React.useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('artifacts-updated', handler);
    return () => window.removeEventListener('artifacts-updated', handler);
  }, [id, isProject]);

  const generateRoadmap = async () => {
    if (!projectId && !id) return alert("Roadmap requires a context.");
    setIsGeneratingRoadmap(true);
    try {
      const url = projectId 
        ? `http://127.0.0.1:8000/api/projects/${projectId}/roadmap/generate`
        : `http://127.0.0.1:8000/api/documents/${id}/roadmap/generate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_or_text: "general" })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
    setIsGeneratingRoadmap(false);
  };

  const handleToggleCompleted = async (itemId, currentCompleted) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/roadmap/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      });
      if (res.ok) {
        setRoadmapItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, completed: !currentCompleted } : item
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectActive = async (itemId, currentActive) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/roadmap/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });
      if (res.ok) {
        setRoadmapItems(prev => prev.map(item => 
          item.id === itemId 
            ? { ...item, active: !currentActive } 
            : { ...item, active: false }
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
    <aside style={{
      width: '360px',
      height: '100%',
      backgroundColor: 'var(--bg-tertiary)',
      borderLeft: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Header Actions */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)' }}>
        <button onClick={() => setIsUploadOpen(true)} style={{ flex: 1, backgroundColor: '#FDF8F5', color: '#1B2A4E', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Upload size={16} /> <span style={{ fontSize: '0.85rem' }}>Upload</span>
        </button>
        <button onClick={() => setIsStudyPlanOpen(true)} style={{ flex: 1, backgroundColor: '#FDF8F5', color: '#1B2A4E', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', overflow: 'hidden' }}>
          <Calendar size={16} style={{ flexShrink: 0 }} /> <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Roadmap</span>
        </button>
        <button onClick={() => setIsSearchOpen(true)} style={{ flex: 1, backgroundColor: '#FDF8F5', color: '#1B2A4E', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Search size={16} /> <span style={{ fontSize: '0.85rem' }}>Search</span>
        </button>
      </div>

      <div style={{ padding: '24px' }}>
        
        {/* Uploaded Documents */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1B2A4E', letterSpacing: '0.05em' }}>UPLOADED</h3>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }} onClick={() => {}}>⋮</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {documents.length === 0 ? (
              <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Uploaded files and links will appear here while AI processes them.
              </div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} color="var(--text-secondary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1B2A4E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.filename}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(doc.upload_date).toLocaleDateString()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-secondary)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-secondary)' }}></div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Sẵn sàng</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => alert(`Link chia sẻ tài liệu công khai: https://workflow.com/share/${doc.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Share2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cộng đồng & Chia sẻ */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1B2A4E', letterSpacing: '0.05em' }}>CỘNG ĐỒNG & CHIA SẺ</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <button onClick={() => alert('Tính năng xem Đề thi được cộng đồng chia sẻ sắp ra mắt!')} style={{ backgroundColor: '#FDF8F5', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#1B2A4E', fontWeight: 600, fontSize: '0.85rem' }}>
              <Users size={16} color="var(--brand-primary)" /> Đề thi được chia sẻ
            </button>
            <button onClick={() => alert('Tính năng xem Tài liệu phòng thi sắp ra mắt!')} style={{ backgroundColor: '#FDF8F5', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#1B2A4E', fontWeight: 600, fontSize: '0.85rem' }}>
              <FileText size={16} color="var(--brand-primary)" /> Tài liệu phòng thi
            </button>
          </div>
        </div>

        {/* Personas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {['Gia sư thân thiện', 'Coach nghiêm túc', 'Socratic hỏi gợi mở', 'Bạn học Gen Z'].map(persona => (
            <button key={persona} onClick={() => setSelectedPersona(persona)} style={{
              padding: '10px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
              backgroundColor: selectedPersona === persona ? 'var(--brand-primary)' : 'white',
              color: selectedPersona === persona ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${selectedPersona === persona ? 'var(--brand-primary)' : 'var(--border-medium)'}`
            }}>
              {persona}
            </button>
          ))}
        </div>
        
        {/* Giáo Án (Roadmap) */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1B2A4E', letterSpacing: '0.05em' }}>GIÁO ÁN</h3>
            <button 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}
              onClick={() => {}}
            >
              ⋮
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {roadmapItems.length === 0 ? (
              <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '16px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Chưa tạo</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Bấm tạo giáo án để Workflow kiểm tra tài liệu, tạo roadmap mặc định và bắt đầu theo dõi mục tiêu học.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setIsCreateLessonPlanOpen(true)}
                    style={{ flex: 1, backgroundColor: '#8A334C', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Tạo giáo án
                  </button>
                  <button 
                    onClick={generateRoadmap}
                    disabled={isGeneratingRoadmap}
                    style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', color: '#8A334C', border: '1px solid var(--border-medium)', padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', cursor: isGeneratingRoadmap ? 'not-allowed' : 'pointer', opacity: isGeneratingRoadmap ? 0.7 : 1 }}
                  >
                    {isGeneratingRoadmap ? 'Đang tạo...' : 'Dùng LLM'}
                  </button>
                </div>
              </div>
            ) : (
              roadmapItems.map((item, idx) => {
                const isCompleted = !!item.completed;
                const isActive = !!item.active;
                return (
                  <div key={item.id} style={{ display: 'flex', gap: '16px', position: 'relative', paddingBottom: idx === roadmapItems.length - 1 ? '0' : '20px' }}>
                    {idx !== roadmapItems.length - 1 && (
                      <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '0', width: '2px', backgroundColor: '#D6C5B3', zIndex: 1 }}></div>
                    )}
                    <div 
                      onClick={() => handleToggleCompleted(item.id, isCompleted)}
                      style={{ flex: '0 0 auto', position: 'relative', zIndex: 2, cursor: 'pointer' }}
                    >
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '50%', 
                        backgroundColor: isCompleted ? '#8A334C' : 'white', 
                        border: `2px solid ${isCompleted ? '#8A334C' : '#D6C5B3'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isCompleted ? 'white' : 'var(--text-muted)'
                       }}>
                        {isCompleted ? <Check size={14} strokeWidth={3} /> : <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{item.step_number}</span>}
                      </div>
                    </div>
                    <div 
                      onClick={() => handleSelectActive(item.id, isActive)}
                      style={{ 
                        flex: 1, 
                        backgroundColor: isActive ? '#FDF8F5' : 'white', 
                        border: isActive ? '2px solid #8A334C' : '1px solid var(--border-light)', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        boxShadow: isActive ? '0 4px 12px rgba(138, 51, 76, 0.1)' : 'var(--shadow-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 700, color: isActive ? '#8A334C' : '#1B2A4E' }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.description}</p>
                      
                      {isActive && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const chatInput = document.querySelector('input[placeholder*="Hỏi"], textarea');
                              const targetInput = chatInput || document.querySelector('input[type="text"]') || document.querySelector('textarea');
                              if (targetInput) {
                                const valueSetter = Object.getOwnPropertyDescriptor(targetInput.constructor.prototype, 'value')?.set;
                                if (valueSetter) {
                                  valueSetter.call(targetInput, `Hãy hướng dẫn tôi học chủ đề "${item.title}": ${item.description}`);
                                } else {
                                  targetInput.value = `Hãy hướng dẫn tôi học chủ đề "${item.title}": ${item.description}`;
                                }
                                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                                targetInput.focus();
                              }
                            }}
                            style={{ 
                              background: 'transparent', 
                              border: '1px solid #8A334C', 
                              color: '#8A334C', 
                              padding: '4px 8px', 
                              borderRadius: '16px', 
                              fontSize: '0.65rem', 
                              fontWeight: 700, 
                              cursor: 'pointer' 
                            }}
                          >
                            Hỏi AI (Chat)
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsExamOpen(true);
                            }}
                            style={{ 
                              background: 'transparent', 
                              border: '1px solid #D6C5B3', 
                              color: 'var(--text-secondary)', 
                              padding: '4px 8px', 
                              borderRadius: '16px', 
                              fontSize: '0.65rem', 
                              fontWeight: 600, 
                              cursor: 'pointer' 
                            }}
                          >
                            Tạo Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* Regenerate row — only when a roadmap already exists (the empty-state card has its own buttons) */}
            {roadmapItems.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => setIsCreateLessonPlanOpen(true)}
                style={{
                  flex: 1,
                  backgroundColor: '#FDF8F5',
                  color: '#8A334C',
                  border: '1px solid #D6C5B3',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Tạo giáo án
              </button>
              <button 
                onClick={generateRoadmap}
                disabled={isGeneratingRoadmap}
                style={{
                  flex: 1,
                  backgroundColor: '#FDF8F5',
                  color: '#8A334C',
                  border: '1px solid #D6C5B3',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: isGeneratingRoadmap ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingRoadmap ? 0.7 : 1,
                  textAlign: 'center'
                }}
              >
                {isGeneratingRoadmap ? 'Đang tạo...' : 'Dùng LLM'}
              </button>
            </div>
            )}
          </div>
        </div>

        {/* Recent Artifacts */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1B2A4E', letterSpacing: '0.05em' }}>RECENT ARTIFACTS</h3>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }} onClick={() => {}}>⋮</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {artifacts.length === 0 ? (
              <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Create a roadmap or plan to see it here.
              </div>
            ) : (
              artifacts.map(artifact => (
                <div key={artifact.id} onClick={() => setViewArtifactId(artifact.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '8px', 
                    backgroundColor: artifact.type === 'quiz' ? '#FEF3C7' : artifact.type === 'notes' ? '#E0E7FF' : '#E6F0EC', 
                    color: artifact.type === 'quiz' ? '#D97706' : artifact.type === 'notes' ? '#4F46E5' : '#059669', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    {artifact.type === 'quiz' ? <AlertCircle size={16} /> : artifact.type === 'notes' ? <FileText size={16} /> : <Network size={16} />}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '0.85rem', fontWeight: 600, color: '#1B2A4E' }}>{artifact.title}</h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(artifact.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </aside>

    <UploadSourcesModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} projectId={projectId} />
    <SearchMaterialsModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    <CreateExamModal isOpen={isExamOpen} onClose={() => setIsExamOpen(false)} projectId={projectId} documentId={isProject ? null : id} onSuccess={fetchData} />
    <ConceptMapModal isOpen={isConceptMapOpen} onClose={() => setIsConceptMapOpen(false)} />
    <FlashcardReviewModal isOpen={isFlashcardOpen} onClose={() => setIsFlashcardOpen(false)} projectId={projectId} documentId={isProject ? null : id} />
    <StudyPlanModal isOpen={isStudyPlanOpen} onClose={() => setIsStudyPlanOpen(false)} />
    <CreateLessonPlanModal isOpen={isCreateLessonPlanOpen} onClose={() => setIsCreateLessonPlanOpen(false)} projectId={projectId} documentId={isProject ? null : id} onSuccess={fetchData} />
    <ArtifactViewerModal isOpen={viewArtifactId !== null} artifactId={viewArtifactId} onClose={() => setViewArtifactId(null)} />
    </>
  );
};

export default ProjectStudioSidebar;
