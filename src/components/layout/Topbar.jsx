import React, { useState, useEffect } from 'react';
import { Search, Bell, Moon, Sun, User, LogOut, Sparkles, Users } from 'lucide-react';
import { signInWithGoogle, signOutGoogle, getStoredUser, isAuthConfigured } from '../../utils/googleAuth';
import PricingModal from '../modals/PricingModal';
import UserProfileModal from '../modals/UserProfileModal';
import ProjectCollaborationModal from '../modals/ProjectCollaborationModal';
import { useLocation, useParams } from 'react-router-dom';

// Official multi-color Google "G" mark for the sign-in button.
const GoogleG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.6 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.4h12.7c-.3 2.1-1.6 5.2-4.6 7.3l7.1 5.5c4.2-3.9 6.9-9.6 6.9-16.1z"/>
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.7 2.3-8.8 2.3-6.3 0-11.7-3.7-13.5-9l-7.9 6.1C6.4 42.6 14.6 48 24 48z"/>
  </svg>
);

const Topbar = () => {
  const [user, setUser] = useState(getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCollabOpen, setIsCollabOpen] = useState(false);

  const location = useLocation();
  const match = location.pathname.match(/\/project\/(\d+)/);
  const projectId = match ? match[1] : null;
  const docMatch = location.pathname.match(/\/document\/(\d+)/);
  const documentId = docMatch ? docMatch[1] : null;

  useEffect(() => {
    // Check initial preference
    if (document.documentElement.classList.contains('dark-mode')) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  };

  const handleLogin = async () => {
    try {
      setUser(await signInWithGoogle());
    } catch (e) {
      alert(e.message || 'Đăng nhập Google thất bại');
    }
  };
  
  const handleLogout = () => {
    signOutGoogle();
    setUser(null);
    setMenuOpen(false);
  };

  return (
    <header className="glass-panel" style={{
      height: '64px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'relative',
      zIndex: 5,
      borderBottom: '1px solid var(--border-light)',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      backgroundColor: 'white'
    }}>
      {/* Search Bar */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} style={{ 
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'
          }} />
          <input 
            type="text" 
            placeholder="Search material..." 
            style={{
              width: '100%', padding: '10px 16px 10px 40px', borderRadius: '24px',
              border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)',
              fontSize: '0.875rem', outline: 'none',
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--brand-primary)';
              e.target.style.boxShadow = '0 0 0 2px rgba(107, 45, 62, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-light)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Center Brand */}
      <div style={{ 
        flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'
      }}>
        <h1 style={{ 
          fontFamily: 'Georgia, serif', 
          fontSize: '1.5rem', 
          fontWeight: 900, 
          color: 'var(--brand-primary)',
          letterSpacing: '-0.01em',
          fontStyle: 'italic',
          margin: 0
        }}>
          Workflow
        </h1>
      </div>

      {/* User Actions */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
        
        {(projectId || documentId) && (
          <button onClick={() => setIsCollabOpen(true)} style={{ 
            background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '24px', 
            padding: '6px 12px', cursor: 'pointer', color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '6px',
            fontWeight: 700, fontSize: '0.85rem'
          }} title="Project Members">
            <Users size={16} color="var(--brand-primary)" />
            1 members
          </button>
        )}

        <button onClick={toggleDarkMode} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Toggle Dark Mode">
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Notifications">
          <Bell size={20} />
        </button>
        
        {/* Google Account */}
        {user ? (
          <div style={{ position: 'relative' }}>
            <div onClick={() => setMenuOpen((o) => !o)} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', borderRadius: '24px',
              cursor: 'pointer', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)'
            }}>
              {user.picture ? (
                <img src={user.picture} alt="" referrerPolicy="no-referrer" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', flexShrink: 0 }}>
                  <User size={16} />
                </div>
              )}
              <div style={{ paddingRight: '8px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1B2A4E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{user.name || 'Tài khoản'}</div>
              </div>
            </div>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '200px', backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '12px', boxShadow: 'var(--shadow-md)', overflow: 'hidden', zIndex: 20 }}>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1B2A4E' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                </div>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#FEF3C7' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={14} /> AI TOKENS
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#B45309', marginTop: '4px' }}>436.8k còn lại</div>
                  <div style={{ fontSize: '0.75rem', color: '#D97706' }}>Đã dùng 63.2k (12.65%)</div>
                </div>
                <button onClick={() => { setMenuOpen(false); setIsProfileOpen(true); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  <User size={16} /> Hồ sơ
                </button>
                <div style={{ borderTop: '1px solid var(--border-light)' }}></div>
                <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B91C1C', fontSize: '0.85rem' }}>
                  <LogOut size={16} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleLogin} disabled={!isAuthConfigured()}
            title={isAuthConfigured() ? '' : 'Chưa cấu hình VITE_GOOGLE_OAUTH_CLIENT_ID'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '24px', border: '1px solid var(--border-medium)', backgroundColor: 'white',
              color: '#1B2A4E', fontWeight: 700, fontSize: '0.85rem',
              cursor: isAuthConfigured() ? 'pointer' : 'not-allowed', opacity: isAuthConfigured() ? 1 : 0.6
            }}>
            <GoogleG /> Đăng nhập
          </button>
        )}
      </div>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} />
      <ProjectCollaborationModal isOpen={isCollabOpen} onClose={() => setIsCollabOpen(false)} projectId={projectId} documentId={documentId} />
    </header>
  );
};

export default Topbar;
