import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import StudioSidebar from './StudioSidebar';
import ProjectStudioSidebar from './ProjectStudioSidebar';

import Topbar from './Topbar';
import { getStoredUser } from '../../utils/googleAuth';
import { MessageSquarePlus } from 'lucide-react';

const AppLayout = () => {
  const location = useLocation();
  const isDocumentView = location.pathname.startsWith('/document/') || location.pathname.startsWith('/project/');
  const [selectedPersona, setSelectedPersona] = useState('Gia sư thân thiện');

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
            <main className="content-area animate-fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Outlet context={{ selectedPersona }} />
            </main>
          </div>
          {isDocumentView ? <ProjectStudioSidebar selectedPersona={selectedPersona} setSelectedPersona={setSelectedPersona} /> : <StudioSidebar />}
        </div>
      </div>
      
      {/* Floating Feedback Button */}
      <button style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#1B2A4E',
        color: 'white',
        border: 'none',
        borderRadius: '24px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-md)',
        zIndex: 50
      }}>
        <MessageSquarePlus size={18} />
        Báo lỗi hoặc gửi feedback
      </button>
    </div>
  );
};

export default AppLayout;
