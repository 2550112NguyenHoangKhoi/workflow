import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, isAuthConfigured, getStoredUser } from '../utils/googleAuth';
import LoginModal from '../components/modals/LoginModal';

const LandingPage = ({ onLoginSuccess }) => {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (getStoredUser()) {
      navigate('/documents', { replace: true });
    }
  }, [navigate]);

  const handleLoginSuccess = (user) => {
    onLoginSuccess(user);
    navigate('/documents');
  };

  return (
    <div style={{ backgroundColor: '#FAFAF9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showLogin && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {/* Top Nav */}
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 48px', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.75rem', fontWeight: 900, color: 'var(--brand-primary)', fontStyle: 'italic' }}>
          Workflow
        </h1>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => setShowLogin(true)}
            style={{ 
              padding: '10px 24px', borderRadius: '24px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', 
              border: '1px solid var(--border-medium)', fontWeight: 600, cursor: 'pointer' 
            }}
          >
            Sign In
          </button>
          <button 
            onClick={() => setShowLogin(true)}
            style={{ 
              padding: '10px 24px', borderRadius: '24px', backgroundColor: 'var(--brand-primary)', color: 'white', 
              border: 'none', fontWeight: 600, cursor: 'pointer' 
            }}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Main CTA & Countdown */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ backgroundColor: '#FCE7F3', color: '#BE185D', padding: '8px 16px', borderRadius: '24px', fontWeight: 700, fontSize: '0.85rem', marginBottom: '24px' }}>
          BETA LAUNCH COUNTDOWN: 14 DAYS
        </div>
        <h2 style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '16px', maxWidth: '800px', lineHeight: 1.2 }}>
          Your Ultimate AI-Powered Study Companion
        </h2>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '600px' }}>
          Accelerate your learning curve with intelligent documents, interactive flashcards, and personalized roadmaps.
        </p>
        <button 
          onClick={() => setShowLogin(true)}
          style={{ 
            padding: '16px 48px', borderRadius: '32px', backgroundColor: 'var(--brand-primary)', color: 'white', 
            border: 'none', fontWeight: 700, fontSize: '1.25rem', cursor: 'pointer', boxShadow: '0 8px 16px rgba(107, 45, 62, 0.2)' 
          }}
        >
          Get Started for Free
        </button>

        {/* Features Blocks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginTop: '64px', maxWidth: '1000px', width: '100%' }}>
          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
            <div style={{ color: 'var(--brand-primary)', fontWeight: 900, fontSize: '1.5rem', marginBottom: '8px' }}>01</div>
            <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: '8px' }}>AI LỘ TRÌNH</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Personalized study plans tailored to your goals.</p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
            <div style={{ color: 'var(--brand-primary)', fontWeight: 900, fontSize: '1.5rem', marginBottom: '8px' }}>02</div>
            <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: '8px' }}>TÀI LIỆU AI</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Interact with your PDFs and documents instantly.</p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
            <div style={{ color: 'var(--brand-primary)', fontWeight: 900, fontSize: '1.5rem', marginBottom: '8px' }}>03</div>
            <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: '8px' }}>SMART REMINDER</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Spaced repetition system to help you memorize faster.</p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
            <div style={{ color: 'var(--brand-primary)', fontWeight: 900, fontSize: '1.5rem', marginBottom: '8px' }}>04</div>
            <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: '8px' }}>CHAT THÔNG MINH</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Get precise answers and tutoring across any topic.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
