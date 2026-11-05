import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import StudioSidebar from './StudioSidebar';
import ProjectStudioSidebar from './ProjectStudioSidebar';
import TeamChatWidget from './TeamChatWidget';

import Topbar from './Topbar';
import FeedbackModal from '../modals/FeedbackModal';
import SmartReminder from '../SmartReminder';

const AppLayout = () => {
  const location = useLocation();
  const isDocumentView = location.pathname.startsWith('/document/') || location.pathname.startsWith('/project/');
  // The right-hand Studio panel (exam/flashcard tools) is only meaningful on the
  // document hub and chat/document views — hide it on full-page tools like the
  // writing practice, active learning, and settings pages so they get the full width.
  const showStudio = !['/writing', '/settings', '/active-learning', '/vocabulary'].includes(location.pathname);
  const projectMatch = location.pathname.match(/^\/project\/(\d+)/);
  const teamProjectId = projectMatch ? projectMatch[1] : null;
  const [selectedPersona, setSelectedPersona] = useState('Gia sư thân thiện');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  // The Studio panel can collapse to a rail so a document gets the width. Default: collapsed
  // on screens too narrow for sidebar + document + chat + Studio side by side.
  const [studioCollapsed, setStudioCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem('workflow_studio_collapsed');
      if (v === '1' || v === '0') return v === '1';
    } catch { /* storage off */ }
    return typeof window !== 'undefined' && window.innerWidth < 1600;
  });
  const toggleStudio = () => setStudioCollapsed(c => {
    try { localStorage.setItem('workflow_studio_collapsed', c ? '0' : '1'); } catch { /* storage off */ }
    return !c;
  });
  useEffect(() => {
    const open = () => { setStudioCollapsed(false); };
    const fb = () => setIsFeedbackOpen(true);
    window.addEventListener('studio-open', open);
    window.addEventListener('open-feedback', fb);
    return () => { window.removeEventListener('studio-open', open); window.removeEventListener('open-feedback', fb); };
  }, []);

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="main-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            <main className="content-area animate-fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Outlet context={{ selectedPersona }} />
            </main>
          </div>
          {isDocumentView ? <ProjectStudioSidebar selectedPersona={selectedPersona} setSelectedPersona={setSelectedPersona} collapsed={studioCollapsed} onToggle={toggleStudio} /> : (showStudio && <StudioSidebar />)}
        </div>
      </div>
      
      {/* Team chat lives bottom-right on project routes; feedback moves left to make room */}
      <TeamChatWidget projectId={teamProjectId} />

      {/* Feedback (the floating button had no click handler and covered the chat input); opened from the top bar. */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <SmartReminder />
    </div>
  );
};

export default AppLayout;
