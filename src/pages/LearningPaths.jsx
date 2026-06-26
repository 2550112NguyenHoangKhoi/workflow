import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Clock, Map, Trash2, CheckCircle2 } from 'lucide-react';
import { generatePath } from '../utils/api';

const LearningPaths = () => {
  const [topic, setTopic] = useState('');
  const [path, setPath] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [completedTopics, setCompletedTopics] = useState({});

  useEffect(() => {
    const savedPath = localStorage.getItem('workflow_path');
    const savedProgress = localStorage.getItem('workflow_progress');
    if (savedPath) setPath(JSON.parse(savedPath));
    if (savedProgress) setCompletedTopics(JSON.parse(savedProgress));
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    
    const newPath = await generatePath(topic);
    if (newPath) {
      setPath(newPath);
      setCompletedTopics({});
      localStorage.setItem('workflow_path', JSON.stringify(newPath));
      localStorage.setItem('workflow_progress', JSON.stringify({}));
    }
    setIsGenerating(false);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to delete your learning path?')) {
      setPath(null);
      setCompletedTopics({});
      localStorage.removeItem('workflow_path');
      localStorage.removeItem('workflow_progress');
      setTopic('');
    }
  };

  const toggleTopic = (moduleIndex, topicIndex) => {
    const key = `${moduleIndex}-${topicIndex}`;
    const newProgress = { ...completedTopics, [key]: !completedTopics[key] };
    setCompletedTopics(newProgress);
    localStorage.setItem('workflow_progress', JSON.stringify(newProgress));
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 className="text-3xl font-bold mb-2">Learning Paths</h2>
          <p className="text-secondary">Let AI build a structured syllabus for any subject you want to master.</p>
        </div>
        {path && (
          <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '0.875rem' }}>
            <Trash2 size={16} /> Delete Path
          </button>
        )}
      </div>

      {!path && (
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
            <Map size={32} />
          </div>
          <div style={{ maxWidth: '400px' }}>
            <h3 className="text-xl font-bold mb-2">What do you want to learn?</h3>
            <p className="text-secondary text-sm mb-6">Enter any topic, skill, or subject, and our AI will generate a step-by-step curriculum with estimated completion times.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quantum Computing, React.js..."
                style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', opacity: isGenerating ? 0.7 : 1 }}
              >
                {isGenerating ? 'Building...' : <><Sparkles size={18} /> Build</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {path && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '60px' }}>
          <div className="glass-card" style={{ padding: '32px', borderLeft: '4px solid var(--brand-primary)' }}>
            <h1 className="text-3xl font-bold mb-4">{path.title}</h1>
            <p className="text-secondary text-lg">{path.description}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', left: '28px', top: '24px', bottom: '24px', width: '2px', backgroundColor: 'var(--border-strong)', zIndex: 0 }}></div>

            {path.modules.map((module, mIndex) => (
              <div key={mIndex} style={{ display: 'flex', gap: '24px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--brand-primary)', flexShrink: 0, marginTop: '8px' }}>
                  {mIndex + 1}
                </div>
                
                <div className="glass-card" style={{ flex: 1, padding: '24px' }}>
                  <h3 className="text-xl font-bold mb-6">{module.title}</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {module.topics.map((t, tIndex) => {
                      const isDone = completedTopics[`${mIndex}-${tIndex}`];
                      return (
                        <div key={tIndex} 
                          onClick={() => toggleTopic(mIndex, tIndex)}
                          style={{ 
                            display: 'flex', 
                            gap: '16px', 
                            padding: '16px', 
                            borderRadius: '12px', 
                            backgroundColor: isDone ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-tertiary)',
                            border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-light)'}`,
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <div style={{ color: isDone ? 'var(--accent-green)' : 'var(--border-strong)' }}>
                            <CheckCircle2 size={24} fill={isDone ? 'rgba(16, 185, 129, 0.1)' : 'none'} />
                          </div>
                          <div style={{ flex: 1, opacity: isDone ? 0.6 : 1 }}>
                            <h4 className="font-semibold mb-1">{t.title}</h4>
                            <p className="text-sm text-secondary mb-3">{t.description}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              <Clock size={14} /> {t.estimated_time}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPaths;
