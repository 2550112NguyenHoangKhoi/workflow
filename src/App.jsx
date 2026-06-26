import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DocumentExplorer from './pages/DocumentExplorer';
import DocumentViewer from './pages/DocumentViewer';
import ExamViewer from './pages/ExamViewer';
import Settings from './pages/Settings';

const IndexRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/documents', { replace: true });
  }, [navigate]);
  return null;
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<IndexRedirect />} />
          <Route path="documents" element={<DocumentExplorer />} />
          {/* Chat maps directly to the DocumentViewer for the project workspace */}
          <Route path="chat" element={<DocumentViewer />} />
          <Route path="document/:id" element={<DocumentViewer />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="exam/:id" element={<ExamViewer />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
