import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import StudioSidebar from './StudioSidebar';
import ProjectStudioSidebar from './ProjectStudioSidebar';

const AppLayout = () => {
  const location = useLocation();
  const isDocumentView = location.pathname.startsWith('/document/');

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <main className="content-area animate-fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Outlet />
        </main>
      </div>
      {isDocumentView ? <ProjectStudioSidebar /> : <StudioSidebar />}
    </div>
  );
};

export default AppLayout;
