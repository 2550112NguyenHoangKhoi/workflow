import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DocumentExplorer from './pages/DocumentExplorer';
import DocumentViewer from './pages/DocumentViewer';
import Flashcards from './pages/Flashcards';
import LearningPaths from './pages/LearningPaths';
import Quizzes from './pages/Quizzes';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import { getLocalFiles } from './utils/storage';
import { getSuggestions } from './utils/api';
import { Sparkles, HelpCircle, FileText } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filesCount, setFilesCount] = useState(0);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const files = getLocalFiles();
      setFilesCount(files.length);
      if (files.length === 0) {
        setLoading(false);
        return;
      }

      const corpus = files.map(f => f.content).join(' ');
      const result = await getSuggestions(corpus);
      setSuggestions(result);
      setLoading(false);
    };
    fetchSuggestions();
  }, []);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 className="text-3xl font-bold mb-4">Welcome to Workflow</h2>
        <p className="text-secondary text-lg">Your personalized AI study dashboard.</p>
      </div>

      <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles color="var(--brand-primary)" /> Recommended for You
        </h3>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Analyzing your library...</div>
        ) : filesCount === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Upload text documents to your library to get personalized study suggestions!
          </div>
        ) : suggestions ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div className="glass-card hover-lift" onClick={() => navigate(`/paths?topic=${suggestions.path_topic}`)} style={{ cursor: 'pointer', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                <Sparkles size={20} /> Learning Path
              </div>
              <p style={{ fontWeight: 500 }}>{suggestions.path_topic}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Based on your documents, start a structured learning path on this topic.</p>
            </div>

            <div className="glass-card hover-lift" onClick={() => navigate(`/quizzes?topic=${suggestions.quiz_topic}`)} style={{ cursor: 'pointer', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600 }}>
                <HelpCircle size={20} /> Knowledge Check
              </div>
              <p style={{ fontWeight: 500 }}>{suggestions.quiz_topic}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Take a quick quiz to test your understanding of this concept.</p>
            </div>

            <div className="glass-card hover-lift" onClick={() => navigate(`/flashcards?topic=${suggestions.flashcard_topic}`)} style={{ cursor: 'pointer', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 600 }}>
                <FileText size={20} /> Review Flashcards
              </div>
              <p style={{ fontWeight: 500 }}>{suggestions.flashcard_topic}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Review these core concepts using spaced repetition flashcards.</p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Could not generate suggestions.</div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<DocumentExplorer />} />
          <Route path="document/:id" element={<DocumentViewer />} />
          <Route path="paths" element={<LearningPaths />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="quizzes" element={<Quizzes />} />
          <Route path="notes" element={<Notes />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="exam/:id" element={<ExamViewer />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
