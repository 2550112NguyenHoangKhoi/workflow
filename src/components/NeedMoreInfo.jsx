import React, { useState } from 'react';
import { AlertTriangle, Upload, Search, ArrowRight } from 'lucide-react';

/**
 * Shown instead of a roadmap when the backend answers status "need_more_info": the sources
 * don't cover the subject (too short, too few topics, a single chapter, off-subject).
 * Renders the reasons and the backend's questions; the answers go back to the generator.
 *
 * props: assessment ({reasons, questions, stats}), onSubmit(answers), onForce(), onUpload?(), onSearch?()
 */
export default function NeedMoreInfo({ assessment, onSubmit, onForce, onUpload, onSearch, compact = false, busy = false }) {
  const qs = assessment?.questions || [];
  const [answers, setAnswers] = useState(() => Object.fromEntries(qs.map(q => [q.id, q.default ?? ''])));
  const set = (id, v) => setAnswers(a => ({ ...a, [id]: v }));
  const filled = Object.entries(answers).some(([k, v]) => k !== 'subject' && String(v ?? '').trim() && !(k === 'hours_per_week' && !String(v).trim()));

  const field = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-ink)', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
  };
  const btn = (primary) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
    fontWeight: 700, fontSize: '0.8rem', cursor: busy ? 'wait' : 'pointer',
    border: primary ? 'none' : '1px solid var(--border-medium)',
    backgroundColor: primary ? 'var(--brand-primary)' : 'var(--bg-tertiary)', color: primary ? 'white' : 'var(--text-navy)',
  });

  const submit = () => {
    const out = {};
    for (const [k, v] of Object.entries(answers)) {
      const t = String(v ?? '').trim();
      if (!t) continue;
      out[k] = k === 'hours_per_week' ? Number(t) : t;
    }
    onSubmit(out);
  };

  return (
    <div data-testid="need-more-info" style={{ display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--accent-amber-text, #D97706)', borderRadius: 14, padding: compact ? 12 : 18 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 800, color: 'var(--text-navy)', fontSize: compact ? '0.85rem' : '0.95rem' }}>Cần thêm thông tin trước khi lập lộ trình</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
            {(assessment?.reasons || []).map(r => <li key={r.code}>{r.message}</li>)}
          </ul>
        </div>
      </div>

      {(onUpload || onSearch) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onUpload && <button style={btn(false)} onClick={onUpload}><Upload size={14} /> Tải thêm tài liệu</button>}
          {onSearch && <button style={btn(false)} onClick={onSearch}><Search size={14} /> Tìm tài liệu</button>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 10 }}>
        {qs.map(q => (
          <label key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: q.type === 'textarea' || q.id === 'subject' ? '1 / -1' : 'auto' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: q.important ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
              {q.label}{q.important ? ' *' : ''}
            </span>
            {q.type === 'select' ? (
              <select value={answers[q.id] ?? ''} onChange={e => set(q.id, e.target.value)} style={field} name={q.id}>
                <option value="">— Chọn —</option>
                {q.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : q.type === 'textarea' ? (
              <textarea rows={compact ? 4 : 5} value={answers[q.id] ?? ''} placeholder={q.placeholder} onChange={e => set(q.id, e.target.value)} style={{ ...field, resize: 'vertical' }} name={q.id} />
            ) : (
              <input type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'} min={q.type === 'number' ? 1 : undefined}
                value={answers[q.id] ?? ''} placeholder={q.placeholder} onChange={e => set(q.id, e.target.value)} style={field} name={q.id} />
            )}
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={{ ...btn(true), flex: 1, opacity: filled ? 1 : 0.6 }} disabled={busy || !filled} onClick={submit}
          title={filled ? '' : 'Trả lời ít nhất một câu (mục tiêu, hạn thi hoặc đề cương)'}>
          Tạo lộ trình với thông tin này <ArrowRight size={14} />
        </button>
        <button style={btn(false)} disabled={busy} onClick={onForce}>Vẫn tạo từ tài liệu hiện có</button>
      </div>
    </div>
  );
}
