import React, { useState, useEffect } from 'react';
import { X, Activity, BookOpen, Target, Loader2, Award } from 'lucide-react';

const StudyDocProgressModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Get latest doc
      const docsRes = await fetch('http://127.0.0.1:8000/api/documents');
      const docsData = await docsRes.json();
      
      if (!docsData.documents || docsData.documents.length === 0) {
        throw new Error("Chưa có tài liệu nào được tải lên.");
      }
      
      const latestDoc = docsData.documents[docsData.documents.length - 1];
      setActiveDoc(latestDoc);
      
      // 2. Get progress stats
      const progRes = await fetch(`http://127.0.0.1:8000/api/documents/${latestDoc.id}/progress`);
      if (!progRes.ok) throw new Error("Failed to fetch progress stats.");
      const progData = await progRes.json();
      
      setData(progData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getDifficultyLabel = (score) => {
    if (score > 60) return { label: 'Advanced', color: '#991B1B', bg: '#FEE2E2' };
    if (score > 30) return { label: 'Intermediate', color: '#92400E', bg: '#FEF3C7' };
    return { label: 'Beginner', color: '#065F46', bg: '#D1FAE5' };
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(27, 42, 78, 0.8)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FAFAFA', borderRadius: '24px', width: '600px', maxWidth: '90vw',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#8A334B', padding: '10px', borderRadius: '12px' }}>
              <Activity color="white" size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>Study Analytics</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                {activeDoc ? `Tracking: ${activeDoc.filename}` : 'Document Progress'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '32px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--brand-primary)' }}>
              <Loader2 size={32} className="animate-spin" style={{ marginBottom: '16px' }} />
              <div style={{ fontWeight: 600 }}>Analyzing document metrics...</div>
            </div>
          ) : error ? (
            <div style={{ color: 'red', textAlign: 'center', fontWeight: 600 }}>{error}</div>
          ) : data ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Readability Card */}
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <BookOpen size={32} color="var(--brand-primary)" style={{ marginBottom: '16px' }} />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Readability Score</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1B2A4E', margin: '8px 0' }}>
                  {data.readability}
                </div>
                {(() => {
                  const diff = getDifficultyLabel(data.readability);
                  return (
                    <div style={{ padding: '4px 12px', backgroundColor: diff.bg, color: diff.color, borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {diff.label} Level
                    </div>
                  );
                })()}
              </div>

              {/* Quiz Performance Card */}
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Target size={32} color="#3B6B59" style={{ marginBottom: '16px' }} />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Quiz Score</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1B2A4E', margin: '8px 0' }}>
                  {data.total_quizzes_taken > 0 ? `${data.average_quiz_score}%` : '--'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <Award size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                  {data.total_quizzes_taken} attempts
                </div>
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StudyDocProgressModal;
