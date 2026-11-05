import React, { useEffect, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

const timeAgo = (iso) => {
  if (!iso) return 'Chưa luyện';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'Hôm nay' : d === 1 ? 'Hôm qua' : `${d} ngày trước`;
};

const getEmail = () => { try { return JSON.parse(localStorage.getItem('workflow_user') || '{}').email; } catch { return undefined; } };

/**
 * Exercise list for a practice mode: topic/chart-type filter, attempts per exercise, "Mới"
 * badge, last practised, paging. onStart(exercise payload) receives /api/practice/exercise/{id}.
 * props: mode, level, task, filterLabel, onStart, initialCategory
 */
export default function ExerciseLibrary({ mode, level = 'beginner', task = '', filterLabel = 'Chủ đề', onStart, refreshKey = 0, labels = {} }) {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);

  useEffect(() => { setPage(1); setCategory(''); }, [mode, level, task]);
  useEffect(() => {
    const q = new URLSearchParams({ mode, level, task, page: String(page), per_page: '6' });
    if (category) q.set(mode === 'ielts' && task === 'task1' ? 'chart_type' : 'category', category);
    const email = getEmail();
    if (email) q.set('email', email);
    fetch(`http://127.0.0.1:8000/api/practice/library?${q}`).then(r => r.json()).then(setData).catch(() => setData({ items: [], total: 0, pages: 1, categories: [] }));
  }, [mode, level, task, category, page, refreshKey]);

  const start = async (id) => {
    setBusy(id);
    try {
      const ex = await (await fetch(`http://127.0.0.1:8000/api/practice/exercise/${encodeURIComponent(id)}`)).json();
      onStart(ex);
    } finally { setBusy(null); }
  };

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Đang tải thư viện bài tập…</div>;
  const chip = (active) => ({ padding: '5px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-medium)'}`, backgroundColor: active ? 'var(--brand-primary)' : 'var(--bg-tertiary)', color: active ? 'white' : 'var(--text-navy)' });

  return (
    <div data-testid="exercise-library" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: 4 }}>{filterLabel}:</span>
        <button style={chip(!category)} onClick={() => { setCategory(''); setPage(1); }}>Tất cả</button>
        {data.categories.map(c => <button key={c} style={chip(category === c)} onClick={() => { setCategory(c); setPage(1); }}>{labels[c] || c}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {data.items.map(it => (
          <div key={it.id} data-testid="exercise-card" style={{ border: '1px solid var(--border-light)', borderRadius: 14, padding: 14, backgroundColor: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ color: 'var(--text-navy)', fontSize: '0.9rem', flex: 1, minWidth: 0 }}>{it.title}</b>
              {it.is_new && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'white', backgroundColor: '#059669', borderRadius: 6, padding: '1px 6px' }}>Mới</span>}
              {it.level && /^[AB][12]$/.test(it.level) && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--brand-primary)', border: '1px solid var(--border-medium)', borderRadius: 6, padding: '1px 6px' }}>{it.level}</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, flex: 1 }}>{it.preview}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span title="Số lần bạn đã hoàn thành bài này">Đã làm: {it.attempts}</span>
              <span>· {timeAgo(it.last_practiced)}</span>
              {it.category && it.category !== it.title && <span>· {labels[it.category] || it.category}</span>}
            </div>
            <button onClick={() => start(it.id)} disabled={busy === it.id} style={{ alignSelf: 'flex-start', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              {it.attempts ? <RotateCcw size={13} /> : <Play size={13} />} {it.attempts ? 'Làm lại' : 'Bắt đầu'}
            </button>
          </div>
        ))}
        {!data.items.length && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chưa có bài tập cho lựa chọn này.</div>}
      </div>
      {data.pages > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <button style={chip(false)} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          Trang {data.page}/{data.pages} · {data.total} bài
          <button style={chip(false)} disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      )}
      {data.pages <= 1 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>{data.total} bài</div>}
    </div>
  );
}
