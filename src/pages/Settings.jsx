import React, { useState, useEffect } from 'react';
import { Key, ExternalLink, Save, CheckCircle2, ShieldAlert } from 'lucide-react';

const Settings = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Key size={32} color="var(--brand-primary)" />
          Application Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Configure your Omilearn AI Study Assistant.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Google Gemini API Key
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
          Omilearn uses Google's powerful Gemini AI to generate flashcards, quizzes, learning paths, and smart notes. 
          Because this is a standalone desktop application, you need to provide your own API key to power the AI engine.
        </p>

        <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderLeft: '4px solid #eab308', padding: '16px', borderRadius: '0 8px 8px 0', marginBottom: '24px' }}>
          <h3 style={{ fontWeight: 600, color: '#ca8a04', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} /> How to get a free API Key:
          </h3>
          <ol style={{ paddingLeft: '24px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>Google AI Studio</a>.</li>
            <li>Sign in with your Google account.</li>
            <li>Click <strong>"Create API Key"</strong> in a new or existing project.</li>
            <li>Copy the key (it should start with <code style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>AIzaSy...</code>).</li>
            <li>Paste it below and click Save.</li>
          </ol>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Your API Key</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..........................."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '1rem'
              }}
            />
            <button 
              onClick={handleSave}
              className="glass-panel"
              style={{
                padding: '0 24px',
                borderRadius: '8px',
                backgroundColor: isSaved ? '#10b981' : 'var(--brand-primary)',
                color: 'white',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease'
              }}
            >
              {isSaved ? <><CheckCircle2 size={18} /> Saved</> : <><Save size={18} /> Save Key</>}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Your key is stored securely on your local device and is only used to communicate directly with Google's API.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
