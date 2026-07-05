import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DocumentExplorer from './pages/DocumentExplorer';
import DocumentViewer from './pages/DocumentViewer';
import DriveViewer from './pages/DriveViewer';
import ExamTaker from './pages/ExamTaker';
import ExamViewer from './pages/ExamViewer';
import Settings from './pages/Settings';
import LandingPage from './pages/LandingPage';
import WritingPractice from './pages/WritingPractice';
import ActiveLearning from './pages/ActiveLearning';
import Vocabulary from './pages/Vocabulary';
import { getStoredUser } from './utils/googleAuth';

const AuthGuard = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const navigate = useNavigate();

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getStoredUser());
    };
    window.addEventListener('storage', handleStorageChange);
    if (!user) {
      navigate('/', { replace: true });
    }
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, navigate]);

  return user ? children : null;
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage onLoginSuccess={() => {}} />} />
        
        <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
          <Route path="documents" element={<DocumentExplorer />} />
          <Route path="chat" element={<DocumentViewer />} />
          <Route path="document/:id" element={<DocumentViewer />} />
          <Route path="project/:id" element={<DocumentViewer />} />
          <Route path="settings" element={<Settings />} />
          <Route path="writing" element={<WritingPractice />} />
          <Route path="active-learning" element={<ActiveLearning />} />
          <Route path="vocabulary" element={<Vocabulary />} />
        </Route>
        
        <Route path="exam/:id" element={<ExamViewer />} />
        <Route path="drive/:fileId" element={<DriveViewer />} />
        <Route path="exam-take/:artifactId" element={<ExamTaker />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
