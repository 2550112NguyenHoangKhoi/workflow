import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sparkles, BookOpen, FileText } from 'lucide-react';

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const userRaw = localStorage.getItem('workflow_user');
  const email = userRaw ? (() => { try { return JSON.parse(userRaw).email; } catch { return null; } })() : null;

  function computeUnread(notifs) {
    const seen = localStorage.getItem('workflow_notif_seen');
    if (!seen) return notifs.length;
    return notifs.filter(n => n.created_at && n.created_at > seen).length;
  }

  async function fetchNotifications() {
    if (!email) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/studio/overview?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json();
      const exams = (data.shared_exams || []).map(n => ({ kind: 'exam', label: n.title, from: n.from, created_at: n.created_at, id: n.id }));
      const examdocs = (data.shared_examdocs || []).map(n => ({ kind: 'examdoc', label: n.title, from: n.from, created_at: n.created_at, id: n.id }));
      const library = (data.shared_library || []).map(n => ({ kind: 'library', label: n.name, from: n.from, created_at: n.created_at, drive_file_id: n.drive_file_id }));
      const merged = [...exams, ...examdocs, ...library].sort((a, b) => {
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return a.created_at < b.created_at ? 1 : -1;
      });
      setNotifications(merged);
      setUnreadCount(computeUnread(merged));
    } catch {}
  }

  useEffect(() => {
    if (!email) return;
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [email]);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleBellClick() {
    if (!email) return;
    if (!open) {
      localStorage.setItem('workflow_notif_seen', new Date().toISOString());
      setUnreadCount(0);
    }
    setOpen(v => !v);
  }

  function handleItemClick(n) {
    setOpen(false);
    if (n.kind === 'library') {
      window.location.hash = `#/drive/${n.drive_file_id}?name=${encodeURIComponent(n.label || '')}`;
    } else {
      window.dispatchEvent(new CustomEvent('open-artifact', { detail: { id: n.id } }));
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const kindMeta = {
    exam: { Icon: Sparkles, color: '#8A334C' },
    examdoc: { Icon: BookOpen, color: 'var(--brand-secondary)' },
    library: { Icon: FileText, color: '#3B82F6' },
  };

  const visible = notifications.slice(0, 8);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={handleBellClick}
        title={!email ? 'Đăng nhập để nhận thông báo' : 'Thông báo'}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: email ? 'pointer' : 'default',
          color: 'var(--text-secondary)',
          position: 'relative',
          padding: 4,
          opacity: email ? 1 : 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bell size={20} />
        {email && unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -6,
            backgroundColor: '#DC2626',
            color: 'white',
            fontSize: '0.6rem',
            borderRadius: '50%',
            minWidth: 15,
            height: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            lineHeight: 1,
            padding: '0 2px',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && email && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 300,
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
            zIndex: 30,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: 12,
            borderBottom: '1px solid var(--border-light)',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: 'var(--text-navy)',
          }}>
            Thông báo
          </div>

          {visible.length === 0 ? (
            <div style={{ padding: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Chưa có thông báo nào. Khi ai đó chia sẻ đề thi hoặc tài liệu, nó sẽ hiện ở đây.
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {visible.map((n, i) => {
                const meta = kindMeta[n.kind] || kindMeta.library;
                const Icon = meta.Icon;
                return (
                  <div
                    key={i}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={16} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-navy)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {n.label || '(Không tên)'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Chia sẻ bởi {n.from} · {formatDate(n.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}