import React, { useState } from 'react';
import { getEngineKey } from '../utils/engine';
import VoiceInput from '../components/VoiceInput';

// XP / "độ nhớ" history kept per concept on this device (learning streak signal).
function recordXp(concept, score) {
  try {
    const all = JSON.parse(localStorage.getItem('workflow_teach_xp') || '{}');
    const prev = all[concept] || { xp: 0, best: 0, sessions: 0 };
    const gained = Math.round(score / 2);
    all[concept] = { xp: prev.xp + gained, best: Math.max(prev.best, score), sessions: prev.sessions + 1, last: new Date().toISOString() };
    localStorage.setItem('workflow_teach_xp', JSON.stringify(all));
    return { gained, total: Object.values(all).reduce((a, c) => a + c.xp, 0) };
  } catch { return { gained: Math.round(score / 2), total: null }; }
}

const LEVELS = [
  { id: 'beginner', title: 'Cơ bản', desc: 'Dành cho người mới bắt đầu' },
  { id: 'intermediate', title: 'Trung cấp', desc: 'Giao tiếp cơ bản và công việc' },
  { id: 'advanced', title: 'Nâng cao', desc: 'Sử dụng ngôn ngữ tự nhiên, phức tạp' }
];

export default function ActiveLearning() {
  const [screen, setScreen] = useState('setup'); // setup, explain, feedback
  
  // Setup state
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [level, setLevel] = useState('beginner');
  
  // Session state (returned from start endpoint)
  const [session, setSession] = useState(null);
  
  // Explain state
  const [explanation, setExplanation] = useState('');
  const [showHints, setShowHints] = useState(false);
  
  // Feedback state
  const [result, setResult] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState('feynman'); // feynman | child ("Dạy bạn nhỏ": the AI asks back)
  const [turns, setTurns] = useState([]);       // child mode: [{ who: 'you'|'child', text }]
  const [childScore, setChildScore] = useState(null);
  const [xp, setXp] = useState(null);
  
  const notify = (text, kind = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStart = async () => {
    if (!topic.trim()) {
      notify('Vui lòng nhập chủ đề.', 'error');
      return;
    }
    setLoading(true);
    try {
      const apiKey = getEngineKey();
      const res = await fetch('http://127.0.0.1:8000/api/teachback/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          context,
          level,
          api_key: apiKey
        })
      });
      const data = await res.json();
      setSession(data);
      setExplanation('');
      setTurns([{ who: 'child', text: `Anh/chị dạy em về “${data.concept}” đi! Em sẽ hỏi lại đến khi em hiểu.` }]);
      setChildScore(null);
      setXp(null);
      setScreen('explain');
      setShowHints(false);
    } catch (e) {
      console.error(e);
      notify('Lỗi khi bắt đầu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const evaluate = async (text) => {
    const res = await fetch('http://127.0.0.1:8000/api/teachback/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept: session.concept, key_points: session.key_points, explanation: text, context,
        api_key: getEngineKey(), persona: mode === 'child' ? 'child' : null,
      })
    });
    return res.json();
  };

  // Child mode: each teaching turn is judged on everything taught so far; the child answers
  // with its next question and how much it understands.
  const handleTeachTurn = async () => {
    if (!explanation.trim()) return;
    const said = explanation.trim();
    const all = [...turns.filter(t => t.who === 'you').map(t => t.text), said].join('\n');
    setTurns(t => [...t, { who: 'you', text: said }]);
    setExplanation('');
    setLoading(true);
    try {
      const data = await evaluate(all);
      setResult(data);
      setChildScore(data.understanding_score ?? 0);
      setTurns(t => [...t, { who: 'child', text: data.child_question || data.followup_question || 'Em hiểu rồi ạ!' }]);
    } catch { notify('Lỗi khi đánh giá', 'error'); } finally { setLoading(false); }
  };

  const finishTeaching = () => {
    if (!result) { notify('Hãy dạy ít nhất một lượt trước khi chấm.', 'error'); return; }
    setXp(recordXp(session.concept, result.understanding_score || 0));
    setScreen('feedback');
  };

  const handleSubmit = async () => {
    if (!explanation.trim()) {
      notify('Vui lòng nhập giải thích của bạn.', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await evaluate(explanation);
      setResult(data);
      setXp(recordXp(session.concept, data.understanding_score || 0));
      setScreen('feedback');
    } catch (e) {
      console.error(e);
      notify('Lỗi khi đánh giá', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowup = () => {
    setExplanation('');
    setScreen('explain');
  };
  
  const handleNewTopic = () => {
    setSession(null);
    setResult(null);
    setTopic('');
    setContext('');
    setScreen('setup');
  };

  const renderSetup = () => (
    <div>
      <h1 style={{ marginBottom: '8px', color: 'var(--text-navy)' }}>Học chủ động (Feynman)</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Giải thích lại kiến thức bằng lời của bạn — AI sẽ đánh giá mức độ hiểu và chỉ ra lỗ hổng.
      </div>
      
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Chủ đề bạn muốn ôn (VD: Định luật Newton thứ hai)</h3>
        <input 
          type="text" 
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Nhập chủ đề..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '1rem', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Dán nội dung tài liệu (không bắt buộc)</h3>
        <textarea 
          rows={5}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Dán nội dung tài liệu..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '1rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {LEVELS.map(l => (
          <div
            key={l.id}
            onClick={() => setLevel(l.id)}
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: level === l.id ? '2px solid #8A334C' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <h3 style={{ margin: '0 0 8px 0' }}>{l.title}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{l.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[['feynman', 'Giải thích (Feynman)', 'Viết lại khái niệm bằng lời của bạn, AI chấm mức độ hiểu.'],
          ['child', 'Dạy bạn nhỏ', 'AI đóng vai một bạn nhỏ hỏi lại từng chỗ chưa rõ — dạy bằng chữ hoặc bằng giọng nói.']].map(([id, t, d]) => (
          <div key={id} onClick={() => setMode(id)} data-mode={id} style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', cursor: 'pointer', border: mode === id ? '2px solid #8A334C' : '2px solid transparent' }}>
            <h3 style={{ margin: '0 0 6px 0' }}>{t}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{d}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleStart}
        disabled={loading}
        style={{
          backgroundColor: 'var(--brand-primary)',
          color: '#fff',
          borderRadius: '24px',
          padding: '12px 24px',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Đang tải...' : 'Bắt đầu'}
      </button>
    </div>
  );

  const renderExplain = () => {
    const wordsCount = explanation.trim() ? explanation.trim().split(/\s+/).length : 0;
    
    return (
      <div>
        <h2 style={{ marginBottom: '16px', color: 'var(--text-navy)' }}>{session?.concept}</h2>
        
        <div style={{ padding: '16px', backgroundColor: 'rgba(138, 51, 76, 0.05)', borderRadius: '8px', borderLeft: '4px solid #8A334C', marginBottom: '24px', color: 'var(--brand-primary)', fontWeight: 600 }}>
          {session?.question_vi}
        </div>

        {session?.key_points && session.key_points.length > 0 && (
          <div style={{ marginBottom: '24px', border: '1px solid var(--border-medium)', borderRadius: '8px', overflow: 'hidden' }}>
            <div 
              style={{ padding: '12px 16px', backgroundColor: 'var(--surface-plain)', borderBottom: showHints ? '1px solid var(--border-medium)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}
              onClick={() => setShowHints(!showHints)}
            >
              <span>Gợi ý những điểm nên nhắc tới</span>
              <span>{showHints ? '▲' : '▼'}</span>
            </div>
            {showHints && (
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)' }}>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)' }}>
                  {session.key_points.map((kp, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>{kp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {mode === 'child' && (
          <div data-testid="child-chat" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {turns.map((t, i) => (
              <div key={i} style={{ alignSelf: t.who === 'you' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '10px 14px', borderRadius: '14px',
                backgroundColor: t.who === 'you' ? 'var(--brand-primary)' : 'var(--bg-tertiary)', color: t.who === 'you' ? 'white' : 'var(--text-ink)', border: t.who === 'you' ? 'none' : '1px solid var(--border-medium)' }}>
                {t.who === 'child' && <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--brand-primary)', marginBottom: 4 }}>🧒 BẠN NHỎ HỎI</div>}
                <span style={{ whiteSpace: 'pre-wrap' }}>{t.text}</span>
              </div>
            ))}
            {childScore !== null && (
              <div style={{ alignSelf: 'center', textAlign: 'center', padding: '8px 18px', borderRadius: '14px', border: '2px solid var(--border-medium)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>ĐỘ HIỂU CỦA BẠN NHỎ</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: childScore >= 80 ? '#065F46' : childScore >= 50 ? '#C2410C' : '#991B1B' }}>{childScore}%</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <VoiceInput onText={(t) => setExplanation(e => (e ? e.trimEnd() + ' ' : '') + t)} title="Dạy bằng giọng nói" />
        </div>
        <textarea
          rows={mode === 'child' ? 5 : 10}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          style={{
            width: '100%', padding: '16px', borderRadius: '8px',
            border: '1px solid var(--border-medium)', marginBottom: '8px',
            resize: 'vertical', fontFamily: 'inherit', fontSize: '1rem', boxSizing: 'border-box'
          }}
          placeholder="Giải thích theo cách hiểu của bạn..."
        />
        <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Số từ: {wordsCount}
        </div>

        {mode === 'child' ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleTeachTurn} disabled={loading || !explanation.trim()} style={{ backgroundColor: 'var(--brand-primary)', color: '#fff', borderRadius: '24px', padding: '12px 24px', border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: explanation.trim() ? 1 : 0.6 }}>
              {loading ? 'Bạn nhỏ đang nghĩ…' : 'Giảng cho bạn nhỏ'}
            </button>
            <button onClick={finishTeaching} disabled={loading} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', borderRadius: '24px', padding: '12px 24px', border: '1px solid var(--border-medium)', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
              Dừng buổi dạy & chấm
            </button>
          </div>
        ) : (
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: 'var(--brand-primary)', color: '#fff', borderRadius: '24px', padding: '12px 24px',
            border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem'
          }}
        >
          {loading ? 'Đang nộp...' : 'Nộp bài giải thích'}
        </button>
        )}
      </div>
    );
  };

  const renderFeedback = () => {
    if (!result) return null;
    
    const score = result.understanding_score || 0;
    const scoreColor = score >= 70 ? '#22C55E' : (score >= 40 ? '#F59E0B' : '#EF4444');

    return (
      <div>
        <h2 style={{ textAlign: 'center', marginBottom: '32px' }}>Kết quả Đánh giá</h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ width: '140px', height: '140px', borderRadius: '50%', border: `12px solid ${scoreColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{score}%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{mode === 'child' ? 'Độ hiểu của bạn nhỏ' : 'Mức độ hiểu'}</span>
          </div>
        </div>
        {xp && (
          <div data-testid="xp" style={{ textAlign: 'center', marginTop: '-16px', marginBottom: '24px', fontWeight: 800, color: '#059669' }}>
            +{xp.gained} XP{xp.total != null ? ` · Tổng ${xp.total} XP` : ''} · Độ nhớ: {score}%
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ padding: '20px', backgroundColor: 'rgba(34, 197, 94, 0.05)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Bạn đã nắm được
            </h3>
            {result.covered && result.covered.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)' }}>
                {result.covered.map((kp, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#16A34A', marginRight: '8px' }}>✓</span>
                    {kp}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chưa có ý nào được bao phủ tốt.</div>
            )}
          </div>
          
          <div style={{ padding: '20px', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#D97706', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Cần ôn lại
            </h3>
            {result.gaps && result.gaps.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)' }}>
                {result.gaps.map((kp, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#D97706', marginRight: '8px' }}>!</span>
                    {kp}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tuyệt vời, bạn không bỏ sót ý chính nào!</div>
            )}
          </div>
        </div>

        {result.misconceptions && result.misconceptions.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#EF4444' }}>Hiểu lầm cần sửa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {result.misconceptions.map((m, i) => (
                <div key={i} style={{ padding: '16px', backgroundColor: 'var(--surface-plain)', border: '1px solid var(--border-medium)', borderRadius: '8px' }}>
                  <div style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginBottom: '8px' }}>{m.claim}</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.correction}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.followup_question && (
          <div style={{ padding: '20px', backgroundColor: 'rgba(138, 51, 76, 0.05)', borderRadius: '12px', border: '1px solid rgba(138, 51, 76, 0.2)', marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--brand-primary)' }}>Câu hỏi đào sâu</h3>
            <div style={{ color: 'var(--text-primary)', marginBottom: '16px', fontWeight: 500 }}>{result.followup_question}</div>
            <button
              onClick={handleFollowup}
              style={{
                backgroundColor: 'var(--brand-primary)', color: '#fff', borderRadius: '24px', padding: '8px 20px',
                border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              Giải thích tiếp
            </button>
          </div>
        )}

        <div style={{ marginBottom: '32px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
          {result.feedback_vi && result.feedback_vi.split('\n').map((para, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>{para}</div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={handleNewTopic}
            style={{
              backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '24px',
              padding: '12px 24px', border: '1px solid var(--border-medium)', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Chủ đề mới
          </button>
          <button
            onClick={() => setScreen('explain')}
            style={{
              backgroundColor: 'var(--brand-primary)', color: '#fff', borderRadius: '24px',
              padding: '12px 24px', border: 'none', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Giải thích lại
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px', width: '100%', boxSizing: 'border-box' }}>
      {screen === 'setup' && renderSetup()}
      {screen === 'explain' && renderExplain()}
      {screen === 'feedback' && renderFeedback()}
      
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: toast.kind === 'error' ? '#EF4444' : '#334155',
          color: '#fff', padding: '12px 24px', borderRadius: '8px', zIndex: 9999,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontWeight: 500
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
