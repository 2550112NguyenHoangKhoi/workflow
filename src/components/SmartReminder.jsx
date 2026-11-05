import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, X, Flame } from 'lucide-react';
import { renderInline } from '../utils/inlineMarkdown';

// Settings (Cài đặt → Nhắc nhở thông minh) live in localStorage.
export const REMINDER_KEY = 'workflow_reminders';
export function getReminderSettings() {
  try { return { enabled: true, minutes: 60, ...JSON.parse(localStorage.getItem(REMINDER_KEY) || '{}') }; }
  catch { return { enabled: true, minutes: 60 }; }
}

const today = () => new Date().toISOString().slice(0, 10);
/** Daily study streak: consecutive days with at least one review / quiz answer. */
export function bumpStreak() {
  try {
    const s = JSON.parse(localStorage.getItem('workflow_streak') || '{}');
    const t = today();
    if (s.last === t) return s.count || 1;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const count = s.last === y ? (s.count || 0) + 1 : 1;
    localStorage.setItem('workflow_streak', JSON.stringify({ last: t, count }));
    return count;
  } catch { return 1; }
}
export function getStreak() {
  try {
    const s = JSON.parse(localStorage.getItem('workflow_streak') || '{}');
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return s.last === today() || s.last === y ? s.count || 0 : 0;
  } catch { return 0; }
}

const shuffle = (a) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const short = (t, n = 110) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/**
 * "Nhắc nhở bằng quiz": every N minutes, if flashcards are due, a notification shows one as a
 * multiple-choice question (A/B/C built from other cards' answers) and an in-app card lets you
 * answer it right there; the answer is graded into the SM-2 schedule and keeps the streak.
 */
export default function SmartReminder() {
  const [quiz, setQuiz] = useState(null); // { card, options, correct }
  const [picked, setPicked] = useState(null);
  const [streak, setStreak] = useState(getStreak());
  const timer = useRef(null);

  const buildQuiz = useCallback(async () => {
    const res = await fetch('http://127.0.0.1:8000/api/flashcards/due');
    if (!res.ok) return null;
    const cards = (await res.json()).flashcards || [];
    if (!cards.length) return null;
    const card = cards[Math.floor(Math.random() * Math.min(cards.length, 5))];
    const others = shuffle(cards.filter(c => c.id !== card.id && c.back !== card.back)).slice(0, 2).map(c => short(c.back));
    const options = shuffle([short(card.back), ...others]);
    return { card, options, correct: options.indexOf(short(card.back)) };
  }, []);

  const fire = useCallback(async (force = false) => {
    const cfg = getReminderSettings();
    if (!cfg.enabled && !force) return;
    try {
      const q = await buildQuiz();
      if (!q) return;
      setQuiz(q); setPicked(null);
      const body = `${short(q.card.front, 140)}\n` + q.options.map((o, i) => `${'ABC'[i]}. ${short(o, 60)}`).join('\n');
      const title = `Ôn nhanh · Streak ${getStreak()} ngày 🔥`;
      if (window.workflowDesktop?.notify) window.workflowDesktop.notify({ title, body });
      else if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const n = new Notification(title, { body });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch { /* backend offline */ }
  }, [buildQuiz]);

  useEffect(() => {
    const schedule = () => {
      clearInterval(timer.current);
      const cfg = getReminderSettings();
      if (cfg.enabled) timer.current = setInterval(() => fire(), Math.max(5, cfg.minutes) * 60000);
    };
    schedule();
    const first = setTimeout(() => fire(), 90000); // one gentle check shortly after opening
    const onChange = () => schedule();
    const onTest = () => fire(true);
    window.addEventListener('reminders-changed', onChange);
    window.addEventListener('reminder-now', onTest);
    const off = window.workflowDesktop?.onNotificationClick?.(() => {});
    return () => {
      clearInterval(timer.current); clearTimeout(first);
      window.removeEventListener('reminders-changed', onChange);
      window.removeEventListener('reminder-now', onTest);
      off?.();
    };
  }, [fire]);

  const answer = async (i) => {
    if (picked !== null || !quiz) return;
    setPicked(i);
    const c = quiz.card;
    try {
      await fetch('http://127.0.0.1:8000/api/flashcards/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, interval: c.interval, ease: c.ease, repetitions: c.repetitions, due: c.due_date, quality: i === quiz.correct ? 4 : 1 }),
      });
    } catch { /* offline */ }
    setStreak(bumpStreak());
  };

  if (!quiz) return null;
  return (
    <div data-testid="smart-reminder" role="dialog" aria-label="Ôn nhanh" style={{ position: 'fixed', right: 20, bottom: 20, width: 340, zIndex: 900, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: 16, boxShadow: '0 16px 32px rgba(0,0,0,0.2)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <BellRing size={16} color="var(--brand-primary)" />
        <b style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', flex: 1 }}>Ôn nhanh</b>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: 3 }}><Flame size={14} /> {streak} ngày</span>
        <button onClick={() => setQuiz(null)} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      <div style={{ fontWeight: 700, color: 'var(--text-navy)', fontSize: '0.9rem', marginBottom: 10 }}>{renderInline(short(quiz.card.front, 220))}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {quiz.options.map((o, i) => {
          const done = picked !== null;
          const ok = i === quiz.correct;
          return (
            <button key={i} onClick={() => answer(i)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 10, fontSize: '0.82rem', cursor: done ? 'default' : 'pointer',
              border: `1px solid ${done && ok ? '#059669' : done && i === picked ? '#DC2626' : 'var(--border-medium)'}`,
              backgroundColor: done && ok ? 'rgba(5,150,105,0.12)' : done && i === picked ? 'rgba(220,38,38,0.1)' : 'var(--surface-plain)', color: 'var(--text-ink)' }}>
              <b>{'ABC'[i]}.</b> {renderInline(o)}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', fontWeight: 700, color: picked === quiz.correct ? '#059669' : '#DC2626' }}>
          {picked === quiz.correct ? '✓ Chính xác! Tiếp tục chuỗi học tập.' : 'Chưa đúng — thẻ này sẽ được nhắc lại sớm.'}
          <button onClick={() => fire(true)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer' }}>Câu khác →</button>
        </div>
      )}
    </div>
  );
}
