import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, X, Clock, CheckCircle2, XCircle, RotateCcw, Trophy, FileImage, Type, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TYPE_LABEL = { mcq: 'TRẮC NGHIỆM', true_false: 'ĐÚNG/SAI', short_answer: 'TRẢ LỜI NGẮN', essay: 'TỰ LUẬN' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function normType(q) {
  if (q.type) return q.type;
  if (q.options) return 'mcq';
  if (q.answer) return 'short_answer';
  return 'essay';
}

// A single PDF page rendered to canvas, synced to the exam's cited source page. Reuses
// pdfjs-dist (same as PdfViewer.jsx) but shows one page at a time so "Trang trước/sau" and
// the per-question source_ref stay in sync.
function SourcePdfPage({ doc, pageNum, zoom }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setW(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !w) return;
    let cancelled = false;
    let renderTask = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = Math.max(120, w * zoom);
        const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport });
        await renderTask.promise;
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.error(`PDF trang ${pageNum}:`, e);
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [doc, pageNum, w, zoom]);

  return (
    <div ref={wrapRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ display: 'block', boxShadow: '0 1px 6px rgba(0,0,0,0.2)', borderRadius: 4, backgroundColor: '#fff' }} />
    </div>
  );
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

  const [sourceDoc, setSourceDoc] = useState(null);
  const [sourcePage, setSourcePage] = useState(0);
  const [sourceMode, setSourceMode] = useState('pdf'); // 'pdf' | 'text'
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);

  const [addCount, setAddCount] = useState(5);
  const [adding, setAdding] = useState(false);

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

        if (d.document_id) {
          fetch(`http://127.0.0.1:8000/api/documents/${d.document_id}`)
            .then(dr => dr.json())
            .then(doc => {
              if (alive && doc && doc.id) {
                setSourceDoc(doc);
              }
            })
            .catch(err => {
              console.error("Lỗi khi tải tài liệu nguồn", err);
            });
        }

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

  // Load the real PDF (not just OCR text) for the reference panel when the exam is linked
  // to a document. Best-effort: if there's no file, we fall back to the text view.
  useEffect(() => {
    const docId = data?.document_id;
    if (!docId) return;
    let cancelled = false;
    setPdfDoc(null);
    setPdfError(false);
    const task = pdfjsLib.getDocument({ url: `http://127.0.0.1:8000/api/documents/${docId}/file` });
    task.promise
      .then((d) => { if (!cancelled) setPdfDoc(d); else d.destroy(); })
      .catch(() => { if (!cancelled) { setPdfError(true); setSourceMode('text'); } });
    return () => { cancelled = true; task.destroy(); };
  }, [data]);

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

  async function addMore() {
    if (adding) return;
    setAdding(true);
    try {
      const key = localStorage.getItem('workflow_api_key') || localStorage.getItem('workflow_gemini_key') || '';
      const r = await fetch(`http://127.0.0.1:8000/api/exams/${artifactId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: Math.max(1, Math.min(20, parseInt(addCount) || 5)), api_key: key }),
      });
      if (!r.ok) throw new Error('add failed');
      const d = await r.json();
      const qs = (d.questions || []).map((q) => ({ ...q, type: normType(q) }));
      setQuestions(qs);
    } catch (e) {
      console.error('Tạo thêm câu hỏi thất bại', e);
    } finally {
      setAdding(false);
    }
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
    const reveal = submitted || showAnswers;
    const gradeable = isGradeable(q);
    const correct = isCorrect(q, i);

    return (
      <div key={i} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 24, border: '1px solid var(--border-light)', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ backgroundColor: '#F8EFEA', color: '#8A334C', fontWeight: 700, fontSize: '0.7rem', borderRadius: 8, padding: '4px 10px' }}>
            CÂU {i + 1} · {TYPE_LABEL[q.type]}
          </span>
          {reveal && gradeable && (
            correct ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22C55E', fontWeight: 700, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} /> Đúng
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444', fontWeight: 700, fontSize: '0.85rem' }}>
                <XCircle size={16} /> Sai
              </span>
            )
          )}
        </div>
        
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-navy)', marginBottom: 16 }}>{q.question}</div>
        
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

        {reveal && (
          <div style={{ borderTop: '1px solid #8A334C', marginTop: 20, paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-navy)' }}>Giải thích chi tiết:</span>
              {q.source_ref && (
                <span style={{ backgroundColor: '#F8EFEA', color: '#8A334C', fontSize: '0.75rem', padding: '2px 8px', borderRadius: 999, border: '1px solid #E5D5C5' }}>
                  {q.source_ref}
                </span>
              )}
            </div>
            
            <div style={{ color: 'var(--text-navy)', marginBottom: 6 }}>
              {(q.type === 'mcq' || q.type === 'true_false') ? (() => {
                const co = (q.options || []).find((o) => o.id === q.correct_option_id);
                const idx = (q.options || []).findIndex((o) => o.id === q.correct_option_id);
                return <strong>Đáp án đúng: {idx >= 0 ? LETTERS[idx] + '. ' : ''}{co ? co.text : ''}</strong>;
              })() : q.type === 'short_answer' ? (
                <strong>Đáp án: {q.answer}</strong>
              ) : (
                <strong>Gợi ý đáp án</strong>
              )}
            </div>
            
            {q.explanation && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {q.explanation}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div style={{ padding: 48, color: 'var(--text-secondary)' }}>Đang tải đề thi…</div>;
  if (error) return <div style={{ padding: 48, color: '#DC2626' }}>{error}</div>;

  const btnRound = { width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
  const lowTime = seconds < 5 * 60;
  const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  
  let answeredCount = 0;
  let gradeableCount = 0;
  questions.forEach((q, i) => {
    if (isGradeable(q)) {
      gradeableCount++;
      if (answers[i] != null && String(answers[i]).trim() !== '') {
        answeredCount++;
      }
    }
  });
  const progressPct = gradeableCount > 0 ? (answeredCount / gradeableCount) * 100 : 0;
  const totalPages = pdfDoc ? pdfDoc.numPages : (sourceDoc ? (sourceDoc.pages?.length || sourceDoc.page_count || 1) : 1);
  const showPdf = sourceMode === 'pdf' && pdfDoc && !pdfError;
  const segBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700,
    padding: '4px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
    borderColor: active ? '#8A334C' : 'var(--border-medium)',
    backgroundColor: active ? '#8A334C' : 'var(--bg-primary)', color: active ? '#fff' : 'var(--text-secondary)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* HEADER BAR */}
      <div style={{ height: 72, backgroundColor: '#E2F0D9', borderBottom: '1px solid var(--border-light)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate(-1)} style={btnRound}><ArrowLeft size={18} /></button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-navy)' }}>{title}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Đề thi học thuật</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={downloadPDF} style={{ backgroundColor: '#3B6B59', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <Download size={16} /> Tải PDF
          </button>
          <button onClick={downloadJSON} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <FileText size={16} /> Tải JSON
          </button>
          <button onClick={() => navigate(-1)} style={btnRound}><X size={18} /></button>
        </div>
      </div>

      {/* BODY GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 300px minmax(300px, 1fr)', flex: 1, overflow: 'hidden' }}>
        
        {/* COLUMN A (LEFT) - QUESTIONS */}
        <div style={{ overflowY: 'auto', padding: 24 }}>
          {questions.map((q, i) => renderQuestion(q, i))}
        </div>

        {/* COLUMN B (MIDDLE) - CONTROL PANEL */}
        <div style={{ overflowY: 'auto', padding: 24, borderLeft: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1, fontSize: '0.75rem', marginBottom: 16 }}>BẢNG ĐIỀU KHIỂN</div>
          
          <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'center' }}>
            <Clock size={20} color={lowTime ? '#DC2626' : 'var(--text-secondary)'} style={{ margin: '0 auto' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '6px 0' }}>Thời gian làm bài</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: lowTime ? '#DC2626' : 'var(--text-navy)' }}>{fmtTime(seconds)}</div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-navy)', marginBottom: 8 }}>TIẾN ĐỘ ÔN TẬP</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{answeredCount}/{gradeableCount} câu đã trả lời</div>
            <div style={{ height: 6, backgroundColor: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: '#3B6B59', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>

          {!submitted && (
            <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-navy)' }}>SỐ CÂU THÊM</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TỐI ĐA 20</div>
              </div>
              <input
                type="number"
                min="1"
                max="20"
                value={addCount}
                onChange={(e) => setAddCount(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, outline: 'none' }}
              />
              <button
                onClick={addMore}
                disabled={adding}
                style={{ backgroundColor: adding ? 'transparent' : '#8A334C', color: adding ? '#8A334C' : '#fff', border: '1px solid #8A334C', borderRadius: 14, padding: 10, fontWeight: 700, width: '100%', cursor: adding ? 'not-allowed' : 'pointer' }}
              >
                {adding ? 'Đang tạo…' : 'Tạo thêm'}
              </button>
            </div>
          )}

          {!submitted ? (
            <>
              <div style={{ backgroundColor: '#F8EFEA', borderRadius: 14, padding: 14, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Làm thử đề thi được AI tạo trực tiếp dựa trên tài liệu bạn đã chọn. Bấm Nộp bài để xem điểm và giải thích chi tiết.
              </div>
              <button onClick={() => doSubmit(false)} style={{ backgroundColor: '#3B6B59', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 800, width: '100%', cursor: 'pointer', marginBottom: 16 }}>
                Nộp bài thi
              </button>
            </>
          ) : (
            <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <Trophy size={32} color="#EAB308" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-navy)', marginBottom: 4 }}>Kết quả làm bài</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#3B6B59' }}>{score.correct} / {score.total}</div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>Đúng {pct}%</div>
              <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                <RotateCcw size={16} /> Làm lại bài thi
              </button>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} style={{ accentColor: '#3B6B59', width: 16, height: 16 }} />
            Hiện đáp án & Giải thích luôn
          </label>
        </div>

        {/* COLUMN C (RIGHT) - SOURCE DOCUMENT */}
        <div style={{ overflowY: 'auto', padding: 24 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1, fontSize: '0.75rem', marginBottom: 16 }}>NGUỒN: TÀI LIỆU ĐỐI CHIẾU</div>
          
          {sourceDoc ? (
            <div style={{ border: '2px solid #8A334C', borderRadius: 16, display: 'flex', flexDirection: 'column', height: 'calc(100% - 32px)' }}>
              <div style={{ padding: 16, borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-navy)', fontSize: '0.9rem', wordBreak: 'break-word', flex: 1 }}>{sourceDoc.filename}</div>
                  {/* PDF ⇄ Văn bản view toggle */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setSourceMode('pdf')} disabled={pdfError} style={{ ...segBtn(showPdf), opacity: pdfError ? 0.4 : 1, cursor: pdfError ? 'not-allowed' : 'pointer' }} title={pdfError ? 'Không tải được PDF' : 'Xem PDF'}>
                      <FileImage size={13} /> PDF
                    </button>
                    <button onClick={() => setSourceMode('text')} style={segBtn(!showPdf)} title="Xem văn bản (OCR)">
                      <Type size={13} /> Văn bản
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trang {sourcePage + 1} / {totalPages}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {showPdf && (
                      <>
                        <button onClick={() => setPdfZoom(z => Math.max(0.5, +(z - 0.2).toFixed(2)))} title="Thu nhỏ" style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', cursor: 'pointer', display: 'flex' }}><ZoomOut size={13} /></button>
                        <button onClick={() => setPdfZoom(z => Math.min(3, +(z + 0.2).toFixed(2)))} title="Phóng to" style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', cursor: 'pointer', display: 'flex' }}><ZoomIn size={13} /></button>
                      </>
                    )}
                    <button
                      onClick={() => setSourcePage(p => Math.max(0, p - 1))}
                      disabled={sourcePage === 0}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6, border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', cursor: sourcePage === 0 ? 'not-allowed' : 'pointer', opacity: sourcePage === 0 ? 0.5 : 1 }}>
                      Trang trước
                    </button>
                    <button
                      onClick={() => setSourcePage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={sourcePage === totalPages - 1}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6, border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', cursor: sourcePage === totalPages - 1 ? 'not-allowed' : 'pointer', opacity: sourcePage === totalPages - 1 ? 0.5 : 1 }}>
                      Trang sau
                    </button>
                  </div>
                </div>
              </div>
              {showPdf ? (
                <div style={{ padding: 16, flex: 1, overflow: 'auto', backgroundColor: '#E9E4DF', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
                  <SourcePdfPage doc={pdfDoc} pageNum={Math.min(sourcePage + 1, totalPages)} zoom={pdfZoom} />
                </div>
              ) : sourceMode === 'pdf' && !pdfError ? (
                <div style={{ padding: 24, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
                  <Loader2 size={16} className="animate-spin" /> Đang tải PDF…
                </div>
              ) : (
                <div style={{ padding: 16, flex: 1, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-navy)', backgroundColor: 'var(--bg-primary)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, lineHeight: 1.6 }}>
                  {(sourceDoc.pages && sourceDoc.pages[sourcePage]) || sourceDoc.content || 'Nội dung trống.'}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', padding: 16 }}>Đề thi này không gắn tài liệu nguồn.</div>
          )}
        </div>

      </div>
    </div>
  );
}

export default ExamTaker;