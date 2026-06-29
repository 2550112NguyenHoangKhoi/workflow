import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, Network, BrainCircuit, Cloud } from 'lucide-react';
import UploadModal from '../modals/UploadModal';
import CreateExamModal from '../modals/CreateExamModal';
import CreateStudyDocModal from '../modals/CreateStudyDocModal';
import ConceptMapModal from '../modals/ConceptMapModal';
import FlashcardReviewModal from '../modals/FlashcardReviewModal';
import SmartNotesModal from '../modals/SmartNotesModal';
import GoogleDriveModal from '../modals/GoogleDriveModal';

// Node.js APIs available because nodeIntegration is true
const fs = window.require ? window.require('fs') : null;
const path = window.require ? window.require('path') : null;
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const os = window.require ? window.require('os') : null;

const StudioSidebar = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isConceptMapOpen, setIsConceptMapOpen] = useState(false);
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [isSmartNotesOpen, setIsSmartNotesOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

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
        <button onClick={() => setIsUploadOpen(true)} style={{ backgroundColor: 'white', border: '1px solid var(--brand-secondary)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <Upload size={20} color="var(--brand-primary)" />
          Upload
        </button>
        <button onClick={() => setIsExamOpen(true)} style={{ backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <FileText size={20} color="var(--text-muted)" />
          Create Exam
        </button>
        <button onClick={() => setIsProgressOpen(true)} style={{ backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <FileText size={20} color="var(--text-muted)" />
          Study Doc
        </button>
        <button onClick={() => setIsSmartNotesOpen(true)} style={{ backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <FileText size={20} color="#1B2A4E" />
          Smart Notes
        </button>
        <button onClick={() => setIsConceptMapOpen(true)} style={{ backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <Network size={20} color="var(--brand-primary)" />
          Concept Map
        </button>
        <button onClick={() => setIsFlashcardOpen(true)} style={{ gridColumn: 'span 2', backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#1B2A4E', fontWeight: 700, fontSize: '0.875rem' }}>
          <BrainCircuit size={20} color="#92400E" />
          Review Flashcards (SM-2)
        </button>
        <button onClick={() => setIsImportOpen(true)} style={{ gridColumn: 'span 2', backgroundColor: '#F8EFEA', border: '1px solid #8A334B', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: '#8A334B', fontWeight: 700, fontSize: '0.875rem' }}>
          <Cloud size={20} color="#8A334B" />
          Nhập từ thư mục / Google Drive
        </button>
      </div>



    </aside>
    
    <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={() => setIsUploadOpen(false)} />
    <CreateExamModal isOpen={isExamOpen} onClose={() => setIsExamOpen(false)} onSuccess={() => {}} />
    <CreateStudyDocModal isOpen={isProgressOpen} onClose={() => setIsProgressOpen(false)} onSuccess={() => {}} />
    <SmartNotesModal isOpen={isSmartNotesOpen} onClose={() => setIsSmartNotesOpen(false)} />
    <ConceptMapModal isOpen={isConceptMapOpen} onClose={() => setIsConceptMapOpen(false)} />
    <FlashcardReviewModal isOpen={isFlashcardOpen} onClose={() => setIsFlashcardOpen(false)} />
    <GoogleDriveModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={() => {}} />
    </>
  );
};

export default StudioSidebar;
