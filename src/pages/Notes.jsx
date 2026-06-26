import React, { useState, useEffect } from 'react';
import { FileText, Save, Trash2 } from 'lucide-react';
import { generateNotes } from '../utils/api';

const Notes = () => {
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('workflow_notes');
    if (saved) setNotes(JSON.parse(saved));
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    const newNotes = await generateNotes(topic);
    if (newNotes) {
      setNotes(newNotes);
      localStorage.setItem('workflow_notes', JSON.stringify(newNotes));
    }
    setIsGenerating(false);
  };

  const handleClear = () => {
    if (confirm('Delete saved notes?')) {
      setNotes(null);
      localStorage.removeItem('workflow_notes');
      setTopic('');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 className="text-3xl font-bold mb-2">Smart Notes</h2>
          <p className="text-secondary">Summarize dense material into beautiful, structured study notes.</p>
        </div>
        {notes && (
          <button onClick={handleClear} style={{ color: '#EF4444', fontSize: '0.875rem' }}>Clear Saved</button>
        )}
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', display: 'flex', gap: '16px' }}>
        <input 
          type="text" 
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic or paste text..."
          style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'var(--brand-primary)', color: 'white', opacity: isGenerating ? 0.7 : 1 }}
        >
          {isGenerating ? 'Generating...' : 'Generate Notes'}
        </button>
      </div>

      {notes ? (
        <div className="glass-card" style={{ padding: '40px' }}>
          <h1 className="text-4xl font-bold mb-6 border-b border-light pb-4">{notes.title}</h1>
          
          <div style={{ padding: '24px', backgroundColor: 'rgba(79, 70, 229, 0.05)', borderRadius: '12px', marginBottom: '40px', borderLeft: '4px solid var(--brand-primary)' }}>
            <p className="text-lg font-medium" style={{ color: 'var(--brand-primary)' }}>Summary</p>
            <p style={{ marginTop: '8px', lineHeight: 1.6 }}>{notes.summary}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {notes.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{section.heading}</h3>
                <ul style={{ listStyleType: 'disc', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {section.bullet_points.map((point, pIdx) => (
                    <li key={pIdx} style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isGenerating && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Enter a topic to generate structured notes!</div>
      )}
    </div>
  );
};

export default Notes;
