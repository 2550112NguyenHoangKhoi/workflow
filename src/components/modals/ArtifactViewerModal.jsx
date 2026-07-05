import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Sparkles, CheckCircle2, XCircle, RotateCcw, Download } from 'lucide-react';

export default function ArtifactViewerModal({ isOpen, onClose, artifactId }) {
  const [artifact, setArtifact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});

  useEffect(() => {
    if (!isOpen || !artifactId) return;
    setArtifact(null);
    setError(null);
    setAnswers({});
    setChecked({});
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/artifacts/${artifactId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setArtifact(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [isOpen, artifactId]);

  const reset = useCallback(() => { setAnswers({}); setChecked({}); }, []);

  if (!isOpen) return null;

  const content = artifact && (typeof artifact.content === 'string' ? {} : artifact.content);
  // Older artifact types (quiz/notes/examprep/studyplan) store their payload at the top
  // level and per-question `type` may be missing — normalize so one viewer opens them all.
  const questions = (content?.questions ?? []).map(q => ({
    ...q,
    type: q.type || (q.options ? 'mcq' : (q.answer ? 'short_answer' : 'essay')),
  }));
  const config = content?.config ?? {};
  const markdownContent = content?.markdown_content ?? '';
  const mapNodes = content?.nodes ?? [];
  const isExamLike = artifact && ['exam', 'quiz'].includes(artifact.type);
  const isMarkdownLike = artifact && ['examdoc', 'examprep', 'studyplan', 'notes'].includes(artifact.type) && !!markdownContent;
  const isConceptMap = artifact && artifact.type === 'concept_map' && mapNodes.length > 0;

  function checkQuestion(idx, q) {
    const userAnswer = answers[idx];
    let result = null;
    if (q.type === 'mcq' || q.type === 'true_false') {
      result = userAnswer === q.correct_option_id ? 'correct' : 'incorrect';
    } else if (q.type === 'short_answer') {
      const expected = (q.answer ?? '').trim().toLowerCase();
      result = (userAnswer ?? '').trim().toLowerCase() === expected ? 'correct' : 'incorrect';
    } else if (q.type === 'essay') {
      result = 'essay';
    }
    setChecked(prev => ({ ...prev, [idx]: result }));
  }

  function downloadMd() {
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title ?? 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const overlayStyle = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const dialogStyle = {
    backgroundColor: '#FCFAF8', borderRadius: 24, width: 750, maxWidth: '95vw',
    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
  };
  const headerStyle = {
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid var(--border-light)',
  };
  const titleStyle = { fontWeight: 900, color: 'var(--text-navy)', fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 8 };
  const closeBtnStyle = {
    width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
    backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const bodyStyle = { flex: 1, overflowY: 'auto', padding: 24 };
  const footerStyle = {
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    padding: '16px 24px', borderTop: '1px solid var(--border-light)',
  };
  const pillBtn = (primary) => ({
    borderRadius: 24, padding: '10px 24px', border: 'none', cursor: 'pointer', fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6,
    backgroundColor: primary ? '#8A334C' : 'var(--bg-tertiary)',
    color: primary ? '#fff' : 'var(--text-navy)',
  });
  const infoStripStyle = {
    display: 'flex', gap: 16, marginBottom: 20, fontSize: 14,
    color: 'var(--text-muted)', flexWrap: 'wrap',
  };

  function renderQuestion(q, idx) {
    const state = checked[idx];
    const borderColor = !state ? 'var(--border-light)'
      : state === 'correct' ? '#22C55E'
      : state === 'incorrect' ? '#EF4444'
      : 'var(--border-light)';
    const borderWidth = state ? 2 : 1;

    const cardStyle = {
      padding: 20, borderRadius: 16, backgroundColor: 'var(--bg-tertiary)',
      border: `${borderWidth}px solid ${borderColor}`, marginBottom: 16,
    };
    const badgeStyle = {
      width: 28, height: 28, borderRadius: '50%', backgroundColor: '#8A334C',
      color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 13, flexShrink: 0,
    };
    const questionHeaderStyle = { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 };
    const questionTextStyle = { fontWeight: 600, color: 'var(--text-navy)', lineHeight: 1.5 };

    const isChecked = !!state;

    function optionStyle(optId) {
      const selected = answers[idx] === optId;
      let border = '1px solid var(--border-light)';
      let bg = '#fff';
      if (isChecked) {
        if (optId === q.correct_option_id) { border = '2px solid #22C55E'; bg = '#F0FDF4'; }
        else if (selected && optId !== q.correct_option_id) { border = '2px solid #EF4444'; bg = '#FEF2F2'; }
      } else if (selected) {
        border = '2px solid #8A334C'; bg = '#FDF4F6';
      }
      return {
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderRadius: 10, border, backgroundColor: bg, cursor: isChecked ? 'default' : 'pointer',
        marginBottom: 8, transition: 'all 0.15s',
      };
    }

    const explanationBoxStyle = {
      marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFF8E7',
      border: '1px solid #FDE68A', fontSize: 14, color: '#92400E',
    };

    const checkBtnStyle = {
      ...pillBtn(true), marginTop: 12, fontSize: 13, padding: '8px 18px',
    };
    const hintBtnStyle = { ...checkBtnStyle, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-navy)' };

    return (
      <div style={cardStyle}>
        <div style={questionHeaderStyle}>
          <span style={badgeStyle}>{idx + 1}</span>
          <span style={questionTextStyle}>{q.question}</span>
        </div>

        {(q.type === 'mcq' || q.type === 'true_false') && (
          <>
            {(q.options ?? []).map(opt => (
              <div key={opt.id} style={optionStyle(opt.id)}
                onClick={() => !isChecked && setAnswers(prev => ({ ...prev, [idx]: opt.id }))}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${answers[idx] === opt.id ? '#8A334C' : '#ccc'}`,
                  backgroundColor: answers[idx] === opt.id ? '#8A334C' : 'transparent',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 14, color: 'var(--text-navy)' }}>{opt.text}</span>
                {isChecked && opt.id === q.correct_option_id && <CheckCircle2 size={16} color="#22C55E" style={{ marginLeft: 'auto' }} />}
                {isChecked && answers[idx] === opt.id && opt.id !== q.correct_option_id && <XCircle size={16} color="#EF4444" style={{ marginLeft: 'auto' }} />}
              </div>
            ))}
            {!isChecked && answers[idx] != null && (
              <button style={checkBtnStyle} onClick={() => checkQuestion(idx, q)}>Kiểm tra</button>
            )}
            {isChecked && (q.explanation) && (
              <div style={explanationBoxStyle}>💡 {q.explanation}</div>
            )}
          </>
        )}

        {q.type === 'short_answer' && (
          <>
            <input
              type="text"
              disabled={isChecked}
              value={answers[idx] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
              placeholder="Nhập câu trả lời..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border-light)', fontSize: 14,
                backgroundColor: isChecked ? '#f9f9f9' : '#fff', boxSizing: 'border-box',
              }}
            />
            {!isChecked && (answers[idx] ?? '').trim() && (
              <button style={checkBtnStyle} onClick={() => checkQuestion(idx, q)}>Kiểm tra</button>
            )}
            {isChecked && (
              <div style={{ ...explanationBoxStyle, borderColor: state === 'correct' ? '#22C55E' : '#EF4444', backgroundColor: state === 'correct' ? '#F0FDF4' : '#FEF2F2', color: state === 'correct' ? '#166534' : '#991B1B' }}>
                {state === 'correct' ? '✅ Chính xác!' : `❌ Đáp án đúng: ${q.answer}`}
                {q.explanation && <div style={{ marginTop: 6, color: '#92400E', backgroundColor: '#FFF8E7', padding: 8, borderRadius: 6 }}>💡 {q.explanation}</div>}
              </div>
            )}
          </>
        )}

        {q.type === 'essay' && (
          <>
            <textarea
              rows={4}
              disabled={isChecked}
              value={answers[idx] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
              placeholder="Viết câu trả lời của bạn..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border-light)', fontSize: 14, resize: 'vertical',
                backgroundColor: isChecked ? '#f9f9f9' : '#fff', boxSizing: 'border-box',
              }}
            />
            {!isChecked && (
              <button style={hintBtnStyle} onClick={() => checkQuestion(idx, q)}>Xem gợi ý đáp án</button>
            )}
            {isChecked && (q.answer || q.explanation) && (
              <div style={explanationBoxStyle}>
                {q.answer && <div><strong>Gợi ý đáp án:</strong> {q.answer}</div>}
                {q.explanation && <div style={{ marginTop: 4 }}>💡 {q.explanation}</div>}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={dialogStyle} className="animate-fade-in">
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            <Sparkles size={20} color="#8A334C" />
            {artifact?.title ?? 'Xem tài liệu'}
          </h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div style={bodyStyle}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Đang tải…</div>
          )}
          {error && (
            <div style={{ color: '#EF4444', padding: 16, textAlign: 'center' }}>⚠️ Lỗi: {error}</div>
          )}

          {isExamLike && (
            <>
              <div style={infoStripStyle}>
                <span>📝 {questions.length} câu hỏi</span>
                {config.duration_minutes && <span>⏱ {config.duration_minutes} phút</span>}
                {config.difficulty && <span>📊 Độ khó: {config.difficulty}</span>}
              </div>
              {questions.map((q, idx) => (
                <React.Fragment key={idx}>{renderQuestion(q, idx)}</React.Fragment>
              ))}
            </>
          )}

          {isConceptMap && (
            <div>
              {mapNodes.map((n, i) => (
                <div key={n.id || i} style={{ padding: 14, borderRadius: 12, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-navy)', fontSize: 14, marginBottom: 4 }}>{n.label}</div>
                  {n.definition && <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.definition}</div>}
                  {n.formula && <div style={{ fontSize: 13, color: '#8A334C', fontFamily: 'monospace', marginTop: 4 }}>{n.formula}</div>}
                </div>
              ))}
            </div>
          )}

          {isMarkdownLike && artifact.type !== 'examdoc' && (
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-navy)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownContent}</ReactMarkdown>
            </div>
          )}

          {artifact && !loading && !error && !isExamLike && !isMarkdownLike && !isConceptMap && artifact.type !== 'examdoc' && (
            <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-muted)' }}>
              {typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content, null, 2)}
            </pre>
          )}

          {artifact && artifact.type === 'examdoc' && (
            <>
              {config.objective && (
                <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14, fontStyle: 'italic' }}>
                  🎯 {config.objective}
                </p>
              )}
              <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-navy)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownContent}</ReactMarkdown>
              </div>
            </>
          )}
        </div>

        <div style={footerStyle}>
          {isExamLike && (
            <button style={pillBtn(false)} onClick={reset}>
              <RotateCcw size={15} /> Làm lại
            </button>
          )}
          {(isMarkdownLike || artifact?.type === 'examdoc') && (
            <button style={pillBtn(false)} onClick={downloadMd}>
              <Download size={15} /> Tải .md
            </button>
          )}
          <button style={pillBtn(true)} onClick={onClose}>
            <X size={15} /> Đóng
          </button>
        </div>
      </div>
    </div>
  );
}