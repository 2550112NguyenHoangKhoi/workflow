import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, Network, BrainCircuit, Cloud, Share2, Sparkles, BookOpen } from 'lucide-react';
import UploadModal from '../modals/UploadModal';
import CreateExamModal from '../modals/CreateExamModal';
import CreateStudyDocModal from '../modals/CreateStudyDocModal';
import ConceptMapModal from '../modals/ConceptMapModal';
import FlashcardReviewModal from '../modals/FlashcardReviewModal';
import SmartNotesModal from '../modals/SmartNotesModal';
import GoogleDriveModal from '../modals/GoogleDriveModal';
import ArtifactViewerModal from '../modals/ArtifactViewerModal';
import { getOwnerEmail } from '../../utils/examSources';

// Node.js APIs available because nodeIntegration is true
const fs = window.require ? window.require('fs') : null;
const path = window.require ? window.require('path') : null;
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const os = window.require ? window.require('os') : null;

const StudioSidebar = () => {
  const navigate = useNavigate();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isConceptMapOpen, setIsConceptMapOpen] = useState(false);
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [isSmartNotesOpen, setIsSmartNotesOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const [viewArtifactId, setViewArtifactId] = useState(null);

  const loadOverview = () => {
    const email = getOwnerEmail();
    fetch(`http://127.0.0.1:8000/api/studio/overview${email ? `?email=${encodeURIComponent(email)}` : ''}`)
      .then(res => res.json())
      .then(setOverview)
      .catch(() => {});
  };

  // Refresh the panels when a create-modal closes (a new exam/doc may exist).
  useEffect(() => { loadOverview(); }, [isExamOpen, isProgressOpen]);

  const handleShare = async (artifactId) => {
    const toEmail = window.prompt('Chia sẻ với email:');
    if (!toEmail) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact_id: artifactId, owner_email: getOwnerEmail() || '', to_email: toEmail.trim() })
      });
      if (res.ok) alert(`Đã chia sẻ với ${toEmail.trim()}!`);
      else alert('Chia sẻ thất bại.');
    } catch { alert('Lỗi kết nối.'); }
  };

  // One row in a studio panel: title opens the item, the share icon shares it.
  const panelItem = (item, { shareable = true, onOpen } = {}) => (
    <div key={`${item.type || 'drive'}-${item.id || item.drive_file_id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', marginBottom: '6px' }}>
      {item.type === 'examdoc' ? <BookOpen size={14} color="var(--brand-secondary)" style={{ flexShrink: 0 }} /> : <Sparkles size={14} color="var(--brand-primary)" style={{ flexShrink: 0 }} />}
      <span onClick={onOpen || (() => setViewArtifactId(item.id))} style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-navy)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title || item.name}>
        {item.title || item.name}
      </span>
      {item.from && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }} title={`Chia sẻ bởi ${item.from}`}>từ {String(item.from).split('@')[0]}</span>}
      {shareable && (
        <button onClick={() => handleShare(item.id)} title="Chia sẻ" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
          <Share2 size={13} />
        </button>
      )}
    </div>
  );

  const panel = (label, count, unit, items, empty, renderItem) => (
    <div style={{ marginBottom: '16px', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '14px', backgroundColor: 'var(--bg-tertiary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.05em' }}>{label}</h4>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{count} {unit}</span>
      </div>
      {items.length === 0
        ? <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{empty}</div>
        : items.map(renderItem)}
    </div>
  );

  const handleSelectWorkspace = async () => {
    if (!ipcRenderer) return alert("Electron IPC not available in browser mode.");
    try {
      const selectedPath = await ipcRenderer.invoke('dialog:openDirectory');
      if (selectedPath) {
        const configPath = path.join(os.homedir(), '.workflow_config.json');
        fs.writeFileSync(configPath, JSON.stringify({ workspace_path: selectedPath }, null, 2));
        alert(`Workspace updated to:\n${selectedPath}\n\nPlease restart the application for the database to move.`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to set workspace.");
    }
  };

  return (
    <>
    <aside style={{
      width: 'var(--studio-width)',
      height: '100%',
      backgroundColor: 'var(--bg-tertiary)',
      borderLeft: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      overflowY: 'auto'
    }}>
      {/* Header Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Studio
        </h2>
      </div>

      {/* Action Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
        <button onClick={() => setIsUploadOpen(true)} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--brand-secondary)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <Upload size={20} color="var(--brand-primary)" />
          Upload
        </button>
        <button onClick={() => setIsExamOpen(true)} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <FileText size={20} color="var(--text-muted)" />
          Create Exam
        </button>
        <button onClick={() => setIsProgressOpen(true)} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <FileText size={20} color="var(--text-muted)" />
          Study Doc
        </button>
        <button onClick={() => setIsSmartNotesOpen(true)} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <FileText size={20} color="#1B2A4E" />
          Smart Notes
        </button>
        <button onClick={() => setIsConceptMapOpen(true)} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <Network size={20} color="var(--brand-primary)" />
          Concept Map
        </button>
        <button onClick={() => setIsFlashcardOpen(true)} style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <BrainCircuit size={20} color="#92400E" />
          Review Flashcards (SM-2)
        </button>
        <button onClick={() => setIsImportOpen(true)} style={{ gridColumn: 'span 2', backgroundColor: '#F8EFEA', border: '1px solid #8A334B', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#8A334B', fontWeight: 700, fontSize: '0.875rem' }}>
          <Cloud size={20} color="#8A334B" />
          Nhập từ thư mục / Google Drive
        </button>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
        Chọn tài liệu từ danh sách (ô tick trên thẻ) hoặc tải tệp trực tiếp trong cấu hình để tạo đề thi &amp; tài liệu phòng thi.
      </p>

      {/* Studio panels: your generated items + items shared with you.
          Exams open in the full-page taker; docs open in the viewer modal. */}
      {panel('ĐỀ THI/TÀI LIỆU CỦA BẠN', overview?.mine?.length || 0, 'bản', overview?.mine || [],
        'Chưa có đề thi/tài liệu nào được tạo.', (it) =>
          panelItem(it, it.type === 'exam' ? { onOpen: () => navigate(`/exam-take/${it.id}`) } : {}))}
      {panel('ĐỀ THI ĐƯỢC CHIA SẺ', overview?.shared_exams?.length || 0, 'đề', overview?.shared_exams || [],
        'Chưa có đề thi nào được chia sẻ với bạn.', (it) =>
          panelItem(it, { shareable: false, onOpen: () => navigate(`/exam-take/${it.id}`) }))}
      {panel('TÀI LIỆU PHÒNG THI ĐƯỢC CHIA SẺ', overview?.shared_examdocs?.length || 0, 'tài liệu', overview?.shared_examdocs || [],
        'Chưa có tài liệu nào được chia sẻ với bạn.', (it) => panelItem(it, { shareable: false }))}
      {panel('TÀI LIỆU THƯ VIỆN ĐƯỢC CHIA SẺ', overview?.shared_library?.length || 0, 'file', overview?.shared_library || [],
        'Chưa có tài liệu thư viện nào được chia sẻ với bạn.', (it) =>
          panelItem(it, { shareable: false, onOpen: () => navigate(`/drive/${it.drive_file_id}?name=${encodeURIComponent(it.name || '')}`) }))}

    </aside>
    
    <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={() => setIsUploadOpen(false)} />
    <CreateExamModal isOpen={isExamOpen} onClose={() => setIsExamOpen(false)} onSuccess={() => {}} />
    <CreateStudyDocModal isOpen={isProgressOpen} onClose={() => setIsProgressOpen(false)} onSuccess={() => {}} />
    <SmartNotesModal isOpen={isSmartNotesOpen} onClose={() => setIsSmartNotesOpen(false)} />
    <ConceptMapModal isOpen={isConceptMapOpen} onClose={() => setIsConceptMapOpen(false)} />
    <FlashcardReviewModal isOpen={isFlashcardOpen} onClose={() => setIsFlashcardOpen(false)} />
    <GoogleDriveModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={() => {}} />
    <ArtifactViewerModal isOpen={viewArtifactId !== null} artifactId={viewArtifactId} onClose={() => setViewArtifactId(null)} />
    </>
  );
};

export default StudioSidebar;
