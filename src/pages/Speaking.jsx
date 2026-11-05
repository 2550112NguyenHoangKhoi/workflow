import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Mic, ChevronRight, Timer, History, Users, MessageSquare, GraduationCap } from 'lucide-react';
import VoiceInput from '../components/VoiceInput';
import ExerciseLibrary from '../components/ExerciseLibrary';
import { getEngineKey } from '../utils/engine';

const API = 'http://127.0.0.1:8000';
const getEmail = () => { try { return JSON.parse(localStorage.getItem('workflow_user') || '{}').email; } catch { return undefined; } };

// Text-to-speech with the system's English voice (works offline in the desktop app).
function speak(text, { rate = 0.95, lang = 'en-US' } = {}) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate;
    const v = synth.getVoices().find(x => x.lang?.startsWith('en'));
    if (v) u.voice = v;
    synth.speak(u);
  } catch { /* no TTS */ }
}

const card = { backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 18 };
const pill = (active) => ({ padding: '7px 14px', borderRadius: 999, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
  border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-medium)'}`, backgroundColor: active ? 'var(--brand-primary)' : 'var(--bg-tertiary)', color: active ? 'white' : 'var(--text-navy)' });
const primary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' };
const ghost = { ...primary, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', border: '1px solid var(--border-medium)' };

/** Coloured words: green = recognised, red = misheard (with what was heard), grey = missed. */
function WordResult({ result }) {
  if (!result) return null;
  return (
    <div data-testid="pron-result" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '1.1rem', fontWeight: 700 }}>
        {result.words.map((w, i) => (
          <span key={i} title={w.status === 'wrong' ? `Máy nghe thành: "${w.heard}"` : w.status === 'missed' ? 'Chưa nghe thấy' : 'Đúng'}
            style={{ color: w.status === 'ok' ? '#059669' : w.status === 'wrong' ? '#DC2626' : 'var(--text-muted)', textDecoration: w.status === 'missed' ? 'underline dotted' : 'none' }}>
            {w.word}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Độ chính xác <b style={{ color: result.accuracy >= 80 ? '#059669' : result.accuracy >= 60 ? '#D97706' : '#DC2626' }}>{result.accuracy}%</b> · Đầy đủ {result.completeness}% · {result.feedback}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Máy nghe được: “{result.transcript}”</div>
    </div>
  );
}

async function scorePron(target, transcript, extra = {}) {
  const res = await fetch(`${API}/api/pronunciation/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, transcript, owner_email: getEmail(), ...extra }) });
  return res.json();
}

// ── Pronunciation: read sentences aloud ──
function Pronunciation() {
  const [level, setLevel] = useState('beginner');
  const [data, setData] = useState({ sentences: [], categories: [] });
  const [category, setCategory] = useState('');
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    fetch(`${API}/api/pronunciation/sentences?level=${level}&category=${encodeURIComponent(category)}`).then(r => r.json()).then(d => { setData(d); setIdx(0); setResult(null); });
  }, [level, category]);
  const s = data.sentences[idx];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['beginner', 'Cơ bản'], ['intermediate', 'Trung cấp'], ['advanced', 'Nâng cao']].map(([id, l]) => <button key={id} style={pill(level === id)} onClick={() => setLevel(id)}>{l}</button>)}
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ marginLeft: 'auto', padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)' }}>
          <option value="">Tất cả chủ đề</option>
          {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {s ? (
        <div style={card}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Câu {idx + 1}/{data.sentences.length} · {s.category}</div>
          <div data-testid="pron-target" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-navy)' }}>{s.text}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{s.vi}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={ghost} onClick={() => speak(s.text)}><Volume2 size={15} /> Nghe mẫu</button>
            <button style={ghost} onClick={() => speak(s.text, { rate: 0.65 })}><Volume2 size={15} /> Nghe chậm</button>
            <VoiceInput lang="en-US" title="Đọc câu này" onText={async (t) => setResult(await scorePron(s.text, t, { exercise_id: s.id, level }))} />
            <button style={{ ...primary, marginLeft: 'auto' }} onClick={() => { setIdx(i => (i + 1) % data.sentences.length); setResult(null); }}>Câu tiếp <ChevronRight size={15} /></button>
          </div>
          <WordResult result={result} />
        </div>
      ) : <div style={{ color: 'var(--text-muted)' }}>Không có câu cho lựa chọn này.</div>}
    </div>
  );
}

// ── Conversation: pick a character and say your lines ──
function Conversation() {
  const [level, setLevel] = useState('beginner');
  const [ex, setEx] = useState(null);
  const [role, setRole] = useState(null);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState({});
  const lines = ex?.sentences || [];
  const line = lines[step];
  const mine = line && line.speaker === role;
  useEffect(() => { if (ex && role && line && !mine) speak(line.reference_en); }, [ex, role, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ex) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['beginner', 'A1–A2'], ['intermediate', 'B1'], ['advanced', 'B2']].map(([id, l]) => <button key={id} style={pill(level === id)} onClick={() => setLevel(id)}>{l}</button>)}
      </div>
      <ExerciseLibrary mode="conversation" level={level} onStart={(e) => { setEx(e); setRole(null); setStep(0); setResults({}); }} />
    </div>
  );
  if (!role) return (
    <div style={card}>
      <h3 style={{ margin: '0 0 4px', color: 'var(--text-navy)' }}>{ex.title}</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>{ex.scene}</p>
      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-navy)' }}>Chọn nhân vật bạn sẽ nói:</div>
      <div style={{ display: 'flex', gap: 8 }}>{ex.speakers.map(sp => <button key={sp} style={primary} onClick={() => setRole(sp)}><Users size={15} /> {sp}</button>)}</div>
      <button style={{ ...ghost, marginTop: 12 }} onClick={() => setEx(null)}>← Chọn hội thoại khác</button>
    </div>
  );
  const scores = Object.values(results).map(r => r.accuracy);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ color: 'var(--text-navy)' }}>{ex.title}</b> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· bạn là {role}</span>
        <button style={{ ...ghost, marginLeft: 'auto', padding: '5px 12px' }} onClick={() => setEx(null)}>Đổi bài</button>
      </div>
      {lines.slice(0, step + 1).map((l, i) => (
        <div key={i} style={{ alignSelf: l.speaker === role ? 'flex-end' : 'flex-start', maxWidth: '80%', ...card, padding: 12, backgroundColor: l.speaker === role ? 'var(--surface-blush)' : 'var(--bg-tertiary)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--brand-primary)' }}>{l.speaker}</div>
          <div style={{ fontWeight: 700, color: 'var(--text-navy)' }}>{l.reference_en}
            <button onClick={() => speak(l.reference_en)} aria-label="Nghe" style={{ background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}><Volume2 size={14} color="var(--brand-primary)" /></button>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.vi}</div>
          {l.speaker === role && i === step && (
            <div style={{ marginTop: 8 }}><VoiceInput lang="en-US" title="Nói lời thoại của bạn" onText={async (t) => {
              const r = await scorePron(l.reference_en, t, { exercise_id: ex.exercise_id });
              setResults(prev => ({ ...prev, [i]: r }));
            }} /></div>
          )}
          {results[i] && <WordResult result={results[i]} />}
        </div>
      ))}
      {step < lines.length - 1 ? (
        <button style={{ ...primary, alignSelf: 'center' }} disabled={mine && !results[step]} onClick={() => setStep(s => s + 1)}>
          {mine && !results[step] ? 'Nói lời thoại để tiếp tục' : 'Tiếp'} <ChevronRight size={15} />
        </button>
      ) : (
        <div data-testid="conv-done" style={{ ...card, textAlign: 'center' }}>
          <b style={{ color: 'var(--text-navy)' }}>Hoàn thành hội thoại!</b>
          <div style={{ color: 'var(--text-secondary)' }}>Độ chính xác trung bình: {scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0}%</div>
        </div>
      )}
    </div>
  );
}

// ── IELTS Speaking answer box: voice → transcript (editable) → band feedback ──
function SpeakingAnswer({ part, question, exerciseId, topic, limitSec, onGraded }) {
  const [text, setText] = useState('');
  const [started, setStarted] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(''); setStarted(null); setResult(null); }, [question]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const elapsed = started ? Math.round((now - started) / 1000) : 0;
  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/speaking/grade`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part, question, transcript: text, duration_sec: started ? (Date.now() - started) / 1000 : null, exercise_id: exerciseId, topic, owner_email: getEmail(), api_key: getEngineKey() }) });
      const r = await res.json();
      setResult(r); onGraded?.(r);
    } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <VoiceInput lang="en-US" title="Trả lời bằng giọng nói" onText={(t) => { if (!started) setStarted(Date.now()); setText(x => (x ? x.trimEnd() + ' ' : '') + t); }} />
        <span style={{ fontSize: '0.8rem', color: limitSec && elapsed > limitSec ? '#DC2626' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Timer size={14} /> {elapsed}s{limitSec ? ` / ${limitSec}s` : ''}
        </span>
        <button style={{ ...ghost, padding: '5px 10px' }} onClick={() => { if (!started) setStarted(Date.now()); }}>Bắt đầu tính giờ</button>
      </div>
      <textarea rows={5} value={text} onChange={e => { if (!started) setStarted(Date.now()); setText(e.target.value); }} placeholder="Bấm micro và nói — lời nói hiện ở đây (có thể sửa hoặc gõ)…"
        style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)', fontFamily: 'inherit', resize: 'vertical' }} />
      <button style={{ ...primary, alignSelf: 'flex-start', opacity: text.trim() ? 1 : 0.5 }} disabled={!text.trim() || busy} onClick={submit}>{busy ? 'Đang chấm…' : 'Nộp câu trả lời'}</button>
      {result && (
        <div data-testid="speaking-result" style={{ ...card, padding: 14 }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: result.overall >= 7 ? '#059669' : result.overall >= 5.5 ? '#D97706' : '#DC2626' }}>Band {result.overall}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
            <span>Trôi chảy {result.bands.fluency}</span><span>Từ vựng {result.bands.lexical}</span><span>Ngữ pháp {result.bands.grammar}</span><span>Mạch lạc {result.bands.coherence}</span>
            {result.wpm ? <span>· {result.wpm} từ/phút</span> : null}
          </div>
          <div style={{ color: 'var(--text-navy)' }}>{result.feedback}</div>
          {result.suggestions?.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>}
          {result.better_answer && <div style={{ marginTop: 8, fontSize: '0.85rem' }}><b>Câu trả lời tốt hơn:</b> {result.better_answer}</div>}
          {result.engine === 'offline' && <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ước tính offline từ lời nói đã nhận dạng (không chấm được ngữ điệu). Bật Gemini trong Cài đặt để có giám khảo AI.</div>}
        </div>
      )}
    </div>
  );
}

function CueCard({ ex }) {
  return (
    <div style={{ ...card, borderStyle: 'dashed' }}>
      <div style={{ fontWeight: 800, color: 'var(--text-navy)', fontSize: '1.05rem' }}>{ex.question}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>You should say:</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{(ex.points || []).map(p => <li key={p}>{p}</li>)}</ul>
    </div>
  );
}

function PrepTimer({ seconds = 60, onDone }) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(false);
  useEffect(() => { const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (left === 0 && !done.current) { done.current = true; onDone(); } }, [left, onDone]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontWeight: 800, color: 'var(--brand-primary)' }}>Chuẩn bị: {left}s</span>
      <button style={ghost} onClick={() => { done.current = true; onDone(); }}>Bỏ qua, nói ngay</button>
    </div>
  );
}

function IeltsSpeaking() {
  const [part, setPart] = useState(1);
  const [ex, setEx] = useState(null);
  const [phase, setPhase] = useState('answer'); // part 2: prep → answer
  const [p3, setP3] = useState(0);
  const [sim, setSim] = useState(null);        // full simulation: { steps: [...], i, bands: [] }

  const startSim = async () => {
    const lib1 = await (await fetch(`${API}/api/practice/library?mode=speaking1&per_page=50`)).json();
    const lib2 = await (await fetch(`${API}/api/practice/library?mode=speaking2&per_page=50`)).json();
    const pick = (a, n) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).slice(0, n).map(v => v[1]);
    const p1 = await Promise.all(pick(lib1.items, 3).map(i => fetch(`${API}/api/practice/exercise/${encodeURIComponent(i.id)}`).then(r => r.json())));
    const card2 = await (await fetch(`${API}/api/practice/exercise/${encodeURIComponent(pick(lib2.items, 1)[0].id)}`)).json();
    const steps = [...p1.map(e => ({ part: 1, ex: e, question: e.question })), { part: 2, ex: card2, question: card2.question },
      ...card2.part3.map(q => ({ part: 3, ex: card2, question: q }))];
    setSim({ steps, i: 0, bands: [] });
    setPhase('prep');
  };

  if (sim) {
    const st = sim.steps[sim.i];
    const finished = sim.i >= sim.steps.length;
    const avg = sim.bands.length ? Math.round((sim.bands.reduce((a, b) => a + b, 0) / sim.bands.length) * 2) / 2 : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ color: 'var(--text-navy)' }}>Thi thử đầy đủ</b>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{finished ? 'Hoàn thành' : `Câu ${sim.i + 1}/${sim.steps.length} · Part ${st.part}`}</span>
          <button style={{ ...ghost, marginLeft: 'auto', padding: '5px 12px' }} onClick={() => setSim(null)}>Thoát</button>
        </div>
        {finished ? (
          <div data-testid="sim-done" style={{ ...card, textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-primary)' }}>Band {avg}</div><div style={{ color: 'var(--text-secondary)' }}>Trung bình {sim.bands.length} câu trả lời</div></div>
        ) : (
          <>
            {st.part === 2 ? <CueCard ex={st.ex} /> : <div style={{ ...card, fontWeight: 800, color: 'var(--text-navy)' }}>{st.question} <button onClick={() => speak(st.question)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Volume2 size={15} color="var(--brand-primary)" /></button></div>}
            {st.part === 2 && phase === 'prep' ? <PrepTimer onDone={() => setPhase('answer')} /> : (
              <SpeakingAnswer part={st.part} question={st.question} exerciseId={st.ex.exercise_id} topic={st.ex.topic} limitSec={st.part === 2 ? 120 : st.part === 1 ? 45 : 75}
                onGraded={(r) => setTimeout(() => { setSim(s => ({ ...s, i: s.i + 1, bands: [...s.bands, r.overall] })); setPhase('prep'); }, 2500)} />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[[1, 'Part 1', 'Câu hỏi về bản thân, chủ đề quen thuộc'], [2, 'Part 2', 'Nói 1–2 phút theo thẻ đề (1 phút chuẩn bị)'], [3, 'Part 3', 'Thảo luận sâu, nêu quan điểm']].map(([id, l, d]) => (
          <button key={id} title={d} style={pill(part === id && !ex)} onClick={() => { setPart(id); setEx(null); setPhase('prep'); setP3(0); }}>{l}</button>
        ))}
        <button style={pill(false)} onClick={startSim}><GraduationCap size={14} style={{ verticalAlign: 'middle' }} /> Thi thử đầy đủ</button>
      </div>
      {!ex ? (
        <ExerciseLibrary mode={part === 1 ? 'speaking1' : 'speaking2'} filterLabel="Chủ đề" onStart={(e) => { setEx(e); setPhase('prep'); setP3(0); }} />
      ) : (
        <>
          <button style={{ ...ghost, alignSelf: 'flex-start', padding: '5px 12px' }} onClick={() => setEx(null)}>← Danh sách</button>
          {part === 1 && (
            <>
              <div style={{ ...card, fontWeight: 800, color: 'var(--text-navy)' }}>{ex.question} <button onClick={() => speak(ex.question)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Volume2 size={15} color="var(--brand-primary)" /></button></div>
              <SpeakingAnswer part={1} question={ex.question} exerciseId={ex.exercise_id} topic={ex.topic} limitSec={45} />
            </>
          )}
          {part === 2 && (
            <>
              <CueCard ex={ex} />
              {phase === 'prep' ? <PrepTimer onDone={() => setPhase('answer')} /> : <SpeakingAnswer part={2} question={ex.question} exerciseId={ex.exercise_id} topic={ex.topic} limitSec={120} />}
            </>
          )}
          {part === 3 && (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chủ đề từ thẻ: {ex.question} · Câu {p3 + 1}/{ex.part3.length}</div>
              <div style={{ ...card, fontWeight: 800, color: 'var(--text-navy)' }}>{ex.part3[p3]} <button onClick={() => speak(ex.part3[p3])} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Volume2 size={15} color="var(--brand-primary)" /></button></div>
              <SpeakingAnswer part={3} question={ex.part3[p3]} exerciseId={`${ex.exercise_id}:p3:${p3}`} topic={ex.topic} limitSec={75} />
              {p3 < ex.part3.length - 1 && <button style={{ ...primary, alignSelf: 'flex-start' }} onClick={() => setP3(i => i + 1)}>Câu tiếp <ChevronRight size={15} /></button>}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SpeakingHistory() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const e = getEmail();
    fetch(`${API}/api/speaking/history${e ? `?email=${encodeURIComponent(e)}` : ''}`).then(r => r.json()).then(d => setRows(d.history || [])).catch(() => setRows([]));
  }, []);
  if (!rows) return <div style={{ color: 'var(--text-muted)' }}>Đang tải…</div>;
  if (!rows.length) return <div style={{ color: 'var(--text-muted)' }}>Chưa có lượt luyện nói nào.</div>;
  return (
    <div data-testid="speaking-history" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.id} style={{ ...card, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>{r.mode === 'speaking' ? `IELTS ${r.task?.replace('part', 'Part ')}` : 'Phát âm'}</span>
            <span>· {new Date(r.created_at).toLocaleString('vi-VN')}</span>
            <b style={{ marginLeft: 'auto', color: 'var(--brand-primary)' }}>{r.mode === 'speaking' ? `Band ${r.overall ?? r.score}` : `${r.accuracy ?? Math.round(r.score * 10)}%`}</b>
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-navy)' }}>{r.question}</div>
          {r.transcript && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>“{r.transcript}”</div>}
        </div>
      ))}
    </div>
  );
}

export default function Speaking() {
  const [tab, setTab] = useState('pron');
  const tabs = [['pron', 'Phát âm', Mic], ['conv', 'Hội thoại', MessageSquare], ['ielts', 'IELTS Speaking', GraduationCap], ['history', 'Lịch sử luyện tập', History]];
  return (
    <div className="animate-fade-in" style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-navy)', margin: '0 0 4px' }}>Luyện nói</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>Luyện phát âm từng câu, nhập vai hội thoại và thi thử IELTS Speaking — nói vào micro, nhận nhận xét ngay.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {tabs.map(([id, l, Icon]) => <button key={id} style={{ ...pill(tab === id), display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setTab(id)}><Icon size={15} /> {l}</button>)}
      </div>
      {tab === 'pron' && <Pronunciation />}
      {tab === 'conv' && <Conversation />}
      {tab === 'ielts' && <IeltsSpeaking />}
      {tab === 'history' && <SpeakingHistory />}
    </div>
  );
}
