import React, { useEffect, useState } from 'react';
import { X, Bug, Lightbulb, Camera, Send, Copy, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useEscape } from '../../utils/useEscape';

/** "Báo lỗi hoặc gửi feedback": message + the current page (auto) + optional screenshot.
 *  Stored locally; "Sao chép" puts a ready-to-send report on the clipboard. */
export default function FeedbackModal({ isOpen, onClose }) {
  useEscape(isOpen, onClose);
  const [kind, setKind] = useState('bug');
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState(null);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const page = typeof window !== 'undefined' ? window.location.hash || '#/' : '';

  const load = () => fetch('http://127.0.0.1:8000/api/feedback').then(r => r.ok ? r.json() : []).then(setHistory).catch(() => setHistory([]));
  useEffect(() => { if (isOpen) { load(); setStatus(null); } }, [isOpen]);

  const capture = async () => {
    try {
      // Hide the dialog while capturing the page behind it.
      const dlg = document.querySelector('[data-feedback-dialog]');
      if (dlg) dlg.style.visibility = 'hidden';
      const url = await toPng(document.body, { pixelRatio: 0.6, cacheBust: true });
      if (dlg) dlg.style.visibility = '';
      setShot(url);
    } catch { setShot(null); }
  };

  const submit = async () => {
    setStatus('sending');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, page, screenshot: shot }),
      });
      if (!res.ok) throw new Error();
      setStatus('sent'); setMessage(''); setShot(null); load();
    } catch { setStatus('error'); }
  };

  if (!isOpen) return null;
  const chip = (active) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-medium)'}`, backgroundColor: active ? 'var(--brand-primary)' : 'var(--bg-tertiary)', color: active ? 'white' : 'var(--text-navy)' });
  const report = `[Workflow ${kind === 'bug' ? 'Báo lỗi' : 'Góp ý'}]\nTrang: ${page}\n\n${message}`;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(27,42,78,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div data-feedback-dialog role="dialog" aria-label="Gửi feedback" style={{ width: 520, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-navy)', flex: 1 }}>Báo lỗi hoặc gửi feedback</h2>
          <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={chip(kind === 'bug')} onClick={() => setKind('bug')}><Bug size={14} /> Báo lỗi</button>
          <button style={chip(kind === 'idea')} onClick={() => setKind('idea')}><Lightbulb size={14} /> Góp ý tính năng</button>
        </div>
        <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả lỗi/góp ý càng cụ thể càng tốt: bạn đã làm gì, mong đợi gì, thấy gì…"
          style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)', fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tự kèm trang hiện tại: <code>{page}</code></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={chip(false)} onClick={capture}><Camera size={14} /> {shot ? 'Chụp lại màn hình' : 'Đính kèm ảnh màn hình'}</button>
          {shot && <img src={shot} alt="Ảnh màn hình" style={{ height: 48, borderRadius: 6, border: '1px solid var(--border-medium)' }} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} disabled={!message.trim() || status === 'sending'} style={{ ...chip(true), flex: 1, justifyContent: 'center', opacity: message.trim() ? 1 : 0.5 }}><Send size={14} /> Gửi</button>
          <button onClick={() => { navigator.clipboard?.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 1500); }} disabled={!message.trim()} style={chip(false)}>
            {copied ? <Check size={14} /> : <Copy size={14} />} Sao chép để gửi email
          </button>
        </div>
        {status === 'sent' && <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>✓ Đã lưu phản hồi. Cảm ơn bạn!</div>}
        {status === 'error' && <div style={{ color: '#EF4444', fontSize: '0.85rem' }}>Không lưu được — backend chưa chạy?</div>}
        {history.length > 0 && (
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.05em', margin: '6px 0' }}>PHẢN HỒI ĐÃ GỬI</div>
            {history.slice(0, 8).map(h => (
              <div key={h.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '6px 0', borderTop: '1px solid var(--border-light)' }}>
                {h.kind === 'bug' ? '🐞' : '💡'} {h.message.slice(0, 120)} <span style={{ color: 'var(--text-muted)' }}>· {new Date(h.created_at).toLocaleDateString('vi-VN')}{h.has_screenshot ? ' · 📷' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
