import React, { useState, useEffect } from 'react';
import { User, X, Mail, Award, Clock } from 'lucide-react';

const UserProfileModal = ({ isOpen, onClose, user }) => {
  const [stats, setStats] = useState({ document_count: 0, project_count: 0, last_login: null });

  useEffect(() => {
    if (isOpen && user?.email) {
      fetch(`http://127.0.0.1:8000/api/user/stats?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(err => console.error("Failed to load user stats", err));
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', width: '400px', borderRadius: '16px',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} color="var(--brand-primary)" />
            Hồ Sơ Của Tôi
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            {user.picture ? (
              <img src={user.picture} alt="Profile" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                <Mail size={14} /> {user.email}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
              <Award size={16} color="#D97706" /> Thống kê học tập
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tài liệu đã tải lên</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats.document_count}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Dự án đang làm</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats.project_count}</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
              <Clock size={16} color="var(--brand-primary)" /> Lịch sử đăng nhập
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Đăng nhập gần nhất: {stats.last_login ? new Date(stats.last_login).toLocaleString() : 'Đang tải...'}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
