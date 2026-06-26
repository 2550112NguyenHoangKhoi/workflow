import React from 'react';
import { Bell, Search, User } from 'lucide-react';

const Topbar = () => {
  return (
    <header className="glass-panel" style={{
      height: 'var(--topbar-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      borderBottom: '1px solid var(--border-light)',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'relative',
          width: '320px'
        }}>
          <Search size={18} style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input 
            type="text" 
            placeholder="Search documents, paths, or flashcards..." 
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              borderRadius: '24px',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
              fontSize: '0.875rem',
              outline: 'none',
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button style={{ color: 'var(--text-secondary)', position: 'relative' }}>
          <Bell size={20} />
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            backgroundColor: 'var(--brand-primary)',
            borderRadius: '50%',
            border: '2px solid var(--glass-bg)'
          }}></span>
        </button>
        <div style={{ 
          width: '36px', 
          height: '36px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--brand-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--brand-primary)',
          cursor: 'pointer'
        }}>
          <User size={18} strokeWidth={2.5} />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
