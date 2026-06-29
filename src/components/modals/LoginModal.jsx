import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '../../utils/googleAuth';

const LoginModal = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      
      // Call backend to sync user to local SQLite DB
      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          picture: user.picture
        })
      });
      
      if (!res.ok) throw new Error('Failed to sync user to database');
      
      const dbUser = await res.json();
      localStorage.setItem('workflow_user', JSON.stringify(dbUser));
      
      if (onLoginSuccess) {
        onLoginSuccess(dbUser);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Đã xảy ra lỗi khi đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', width: '400px', borderRadius: '24px',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
        padding: '32px', textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          Workflow
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
          Đăng nhập để bắt đầu sử dụng không gian làm việc của bạn.
        </p>

        {error && (
          <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          style={{ 
            padding: '16px', borderRadius: '12px', backgroundColor: 'white', 
            color: 'var(--text-primary)', border: '1px solid var(--border-light)', 
            fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s', fontSize: '1rem',
            opacity: loading ? 0.7 : 1
          }}
          onMouseOver={(e) => { if(!loading) e.currentTarget.style.backgroundColor = '#f9fafb' }}
          onMouseOut={(e) => { if(!loading) e.currentTarget.style.backgroundColor = 'white' }}
        >
          {loading ? (
            <Loader2 size={20} className="spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.6 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.4h12.7c-.3 2.1-1.6 5.2-4.6 7.3l7.1 5.5c4.2-3.9 6.9-9.6 6.9-16.1z"/>
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.7 2.3-8.8 2.3-6.3 0-11.7-3.7-13.5-9l-7.9 6.1C6.4 42.6 14.6 48 24 48z"/>
            </svg>
          )}
          Tiếp tục với Google
        </button>
      </div>
    </div>
  );
};

export default LoginModal;
