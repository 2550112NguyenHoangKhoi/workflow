import React, { useState, useEffect } from 'react';
import { User, X, Mail, Award, Clock } from 'lucide-react';
import { useEscape } from '../../utils/useEscape';

const storedUser = () => { try { return JSON.parse(localStorage.getItem('workflow_user') || 'null'); } catch { return null; } };

// The sidebar's "Hồ sơ của tôi" opens this without a user prop: fall back to the signed-in
// user (it used to render nothing, so the button did nothing).
const UserProfileModal = ({ isOpen, onClose, user: userProp }) => {
  const user = userProp || (isOpen ? storedUser() : null);
  useEscape(isOpen, onClose);
  const [stats, setStats] = useState({ document_count: 0, project_count: 0, last_login: undefined });
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (isOpen && user?.email) {
      fetch(`http://127.0.0.1:8000/api/user/stats?email=${encodeURIComponent(user.email)}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => { if (data) setStats(data); })
        .catch(err => console.error("Failed to load user stats", err));
      // Points, streak and recent activity across writing, speaking and pronunciation practice.
      fetch(`http://127.0.0.1:8000/api/writing/progress?email=${encodeURIComponent(user.email)}`)
        .then(res => (res.ok ? res.json() : null)).then(setProgress).catch(() => setProgress(null));
    }
  }, [isOpen, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  let teachXp = 0, reviewStreak = 0;
  try {
    teachXp = Object.values(JSON.parse(localStorage.getItem('workflow_teach_xp') || '{}')).reduce((a, c) => a + (c.xp || 0), 0);
    reviewStreak = JSON.parse(localStorage.getItem('workflow_streak') || '{}').count || 0;
  } catch { /* storage off */ }
  const MODE_LABEL = { sentence: 'Luyện câu', paragraph: 'Luyện đoạn văn', conversation: 'Hội thoại', ielts: 'IELTS Writing',
    ielts_translate: 'IELTS · dịch bài mẫu', speaking: 'IELTS Speaking', pronunciation: 'Phát âm' };

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

          <div data-testid="profile-achievements" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '10px' }}>
              <Award size={16} color="var(--brand-primary)" /> Thành tích luyện tập
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '10px' }}>
              {[['Tổng điểm', (progress?.total_points ?? 0) + teachXp], ['Chuỗi luyện viết/nói', `${progress?.streak ?? 0} ngày`], ['Chuỗi ôn tập', `${reviewStreak} ngày`], ['Số buổi', progress?.sessions ?? 0]].map(([l, v]) => (
                <div key={l} style={{ padding: '8px 4px', borderRadius: '10px', backgroundColor: 'var(--surface-plain)' }}>
                  <div style={{ fontWeight: 900, color: 'var(--brand-primary)', fontSize: '1.05rem' }}>{v}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>Hoạt động gần đây</div>
            {(progress?.recent || []).length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chưa có buổi luyện tập nào.</div>
            ) : progress.recent.slice(0, 5).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '3px 0', color: 'var(--text-primary)' }}>
                <span>{MODE_LABEL[r.mode] || r.mode}{r.category ? ` · ${r.category}` : r.task ? ` · ${r.task}` : ''}</span>
                <span style={{ color: 'var(--text-muted)' }}>+{r.points} · {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : ''}</span>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
              <Clock size={16} color="var(--brand-primary)" /> Lịch sử đăng nhập
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Đăng nhập gần nhất: {stats.last_login ? new Date(stats.last_login).toLocaleString() : stats.last_login === null ? '—' : 'Đang tải...'}
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
