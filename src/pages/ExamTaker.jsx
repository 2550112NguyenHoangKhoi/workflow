import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, X, Clock, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

const TYPE_LABEL = { mcq: 'TRẮC NGHIỆM', true_false: 'ĐÚNG/SAI', short_answer: 'TRẢ LỜI NGẮN', essay: 'TỰ LUẬN' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function normType(q) {
  if (q.type) return q.type;
  if (q.options) return 'mcq';
  if (q.answer) return 'short_answer';
  return 'essay';
}

function ExamTaker() {
  const { artifactId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState({});
  const [title, setTitle] = useState('');

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const [seconds, setSeconds] = useState(45 * 60);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetch(`http://127.0.0.1:8000/api/artifacts/${artifactId}`)
      .then((r) => { if (!r.ok) throw new Error('Không tải được đề thi'); return r.json(); })
      .then((d) => {
        if (!alive) return;
        const content = d.content || {};
        const cfg = content.config || {};
        const qs = (content.questions || []).map((q) => ({ ...q, type: normType(q) }));
        setData(d);
        setTitle(d.title || 'Đề thi');
        setConfig(cfg);
        setQuestions(qs);
        setSeconds((cfg.duration_minutes || 45) * 60);
        setLoading(false);
      })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [artifactId]);

  useEffect(() => {
    if (loading || submitted) return;
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          doSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [loading, submitted]);

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function isGradeable(q) { return q.type === 'mcq' || q.type === 'true_false' || q.type === 'short_answer'; }

  function isCorrect(q, i) {
    const a = answers[i];
    if (q.type === 'mcq' || q.type === 'true_false') return a != null && a === q.correct_option_id;
    if (q.type === 'short_answer') return a != null && String(a).trim().toLowerCase() === String(q.answer || '').trim().toLowerCase();
    return false;
  }

  function grade() {
    let correct = 0, total = 0;
    questions.forEach((q, i) => {
      if (!isGradeable(q)) return;
      total++;
      if (isCorrect(q, i)) correct++;
    });
    return { correct, total };
  }

  function doSubmit(auto) {
    if (submittedRef.current) return;
    if (!auto) {
      const unanswered = questions.some((q, i) => isGradeable(q) && (answers[i] == null || answers[i] === ''));
      if (unanswered && !window.confirm('Còn câu chưa trả lời. Bạn vẫn muốn nộp bài?')) return;
    }
    submittedRef.current = true;
    clearInterval(timerRef.current);
    setScore(grade());
    setSubmitted(true);
  }

  function reset() {
    submittedRef.current = false;
    setAnswers({});
    setSubmitted(false);
    setScore({ correct: 0, total: 0 });
    setSeconds((config.duration_minutes || 45) * 60);
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify({ title, config, questions }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    const reveal = submitted || showAnswers;
    const esc = (s) => String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family:sans-serif;padding:24px;max-width:800px;margin:0 auto">`;
    html += `<h1>${esc(title)}</h1>`;
    questions.forEach((q, i) => {
      html += `<div style="margin-bottom:20px"><p><strong>Câu ${i + 1}. (${TYPE_LABEL[q.type]})</strong> ${esc(q.question)}</p>`;
      if (q.options) {
        html += '<ul>';
        q.options.forEach((o, oi) => { html += `<li>${LETTERS[oi]}. ${esc(o.text)}</li>`; });
        html += '</ul>';
      }
      if (reveal) {
        if (q.options && q.correct_option_id != null) {
          const co = q.options.find((o) => o.id === q.correct_option_id);
          html += `<p><em>Đáp án: ${esc(co ? co.text : q.correct_option_id)}</em></p>`;
        } else if (q.answer) {
          html += `<p><em>Đáp án: ${esc(q.answer)}</em></p>`;
        }
        if (q.explanation) html += `<p><em>Giải thích: ${esc(q.explanation)}</em></p>`;
      }
      html += '</div>';
    });
    html += '</body></html>';
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }

  function renderExplanation(q) {
    if (!(submitted || showAnswers)) return null;
    let body = null;
    if (q.type === 'mcq' || q.type === 'true_false') {
      const co = (q.options || []).find((o) => o.id === q.correct_option_id);
      const idx = (q.options || []).findIndex((o) => o.id === q.correct_option_id);
      body = <div><strong>Đáp án đúng: {idx >= 0 ? LETTERS[idx] + '. ' : ''}{co ? co.text : ''}</strong></div>;
    } else if (q.type === 'short_answer') {
      body = <div><strong>Đáp án: {q.answer}</strong></div>;
    } else {
      body = <div><strong>Gợi ý đáp án</strong></div>;
    }
    return (
      <div style={{ backgroundColor: '#FFF8E7', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 12, padding: 12, fontSize: '0.85rem', marginTop: 12 }}>
        {body}
        {q.explanation && <div style={{ marginTop: 6 }}>{q.explanation}</div>}
      </div>
    );
  }

  function renderOptions(q, i) {
    return (q.options || []).map((o, oi) => {
      const selected = answers[i] === o.id;
      let border = '1px solid var(--border-light)';
      let bg = 'transparent';
      let badgeBg = 'transparent';
      let badgeColor = 'var(--text-navy)';
      let badgeBorder = '1px solid var(--border-medium)';
      if (!submitted && selected) {
        border = '2px solid #8A334C';
        badgeBg = '#8A334C';
        badgeColor = '#fff';
        badgeBorder = '1px solid #8A334C';
      }
      if (submitted) {
        if (o.id === q.correct_option_id) { border = '1px solid #22C55E'; bg = '#F0FDF4'; }
        else if (selected) { border = '1px solid #EF4444'; bg = '#FEF2F2'; }
      }
      return (
        <div key={o.id} onClick={() => { if (!submitted) setAnswers((a) => ({ ...a, [i]: o.id })); }}
          style={{ border, backgroundColor: bg, borderRadius: 14, padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center', cursor: submitted ? 'default' : 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: badgeBorder, backgroundColor: badgeBg, color: badgeColor, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.85rem' }}>{LETTERS[oi]}</div>
          <div style={{ color: 'var(--text-navy)' }}>{o.text}</div>
        </div>
      );
    });
  }

  function renderQuestion(q, i) {
    return (
      <div key={i} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 20, border: '1px solid var(--border-light)', padding: 24, marginBottom: 20 }}>
        <span style={{ backgroundColor: '#F8EFEA', color: '#8A334C', fontWeight: 700, fontSize: '0.7rem', borderRadius: 8, padding: '4px 10px' }}>
          CÂU {i + 1} · {TYPE_LABEL[q.type]}
        </span>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-navy)', margin: '12px 0 16px' }}>{q.question}</div>
        {(q.type === 'mcq' || q.type === 'true_false') && renderOptions(q, i)}
        {q.type === 'short_answer' && (
          <input type="text" disabled={submitted} value={answers[i] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
            placeholder="Nhập câu trả lời…"
            style={{ width: '100%', border: '1px solid var(--border-light)', borderRadius: 14, padding: '12px 16px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
        )}
        {q.type === 'essay' && (
          <textarea rows={4} disabled={submitted} value={answers[i] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
            placeholder="Viết bài luận của bạn…"
            style={{ width: '100%', border: '1px solid var(--border-light)', borderRadius: 14, padding: '12px 16px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} />
        )}
        {renderExplanation(q)}
      </div>
    );
  }

  if (loading) return <div style={{ padding: 48, color: 'var(--text-secondary)' }}>Đang tải đề thi…</div>;
  if (error) return <div style={{ padding: 48, color: '#DC2626' }}>{error}</div>;

  const btnRound = { width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
  const lowTime = seconds < 5 * 60;
  const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate(-1)} style={btnRound}><ArrowLeft size={18} /></button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-navy)' }}>{title}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Đề thi học thuật</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={downloadPDF} style={{ backgroundColor: '#2C5E4F', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <Download size={16} /> Tải PDF
          </button>
          <button onClick={downloadJSON} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <FileText size={16} /> Tải JSON
          </button>
          <button onClick={() => navigate(-1)} style={btnRound}><X size={18} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
            {questions.map((q, i) => renderQuestion(q, i))}
          </div>
        </div>

        <div style={{ width: 320, overflowY: 'auto', padding: 24 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1, fontSize: '0.75rem', marginBottom: 16 }}>BẢNG ĐIỀU KHIỂN</div>

          <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 16, marginBottom: 16, textAlign: 'center' }}>
            <Clock size={20} color={lowTime ? '#DC2626' : 'var(--text-secondary)'} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '6px 0' }}>Thời gian làm bài</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: lowTime ? '#DC2626' : 'var(--text-navy)' }}>{fmtTime(seconds)}</div>
          </div>

          <div style={{ backgroundColor: '#F8EFEA', borderRadius: 14, padding: 14, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            Làm thử đề thi được AI tạo trực tiếp dựa trên tài liệu bạn đã chọn. Bấm Nộp bài để xem điểm và giải thích chi tiết.
          </div>

          {!submitted ? (
            <button onClick={() => doSubmit(false)} style={{ backgroundColor: '#2C5E4F', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 800, width: '100%', cursor: 'pointer', marginBottom: 16 }}>
              Nộp bài thi
            </button>
          ) : (
            <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#2C5E4F' }}>{score.correct}/{score.total}</div>
              <div style={{ color: 'var(--text-secondary)', margin: '4px 0' }}>Đúng {score.correct} / {score.total} câu</div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>{pct}%</div>
              <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#F8EFEA', color: '#8A334C', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
                <RotateCcw size={14} /> Làm lại
              </button>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} style={{ accentColor: '#2C5E4F', width: 16, height: 16 }} />
            Hiện đáp án & Giải thích luôn
          </label>
        </div>
      </div>
    </div>
  );
}

export default ExamTaker;