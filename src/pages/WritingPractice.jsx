import React, { useState, useEffect } from 'react';
import { Volume2, X } from 'lucide-react';

function getEmail() {
  try { return JSON.parse(localStorage.getItem('workflow_user') || '{}').email; }
  catch (e) { return undefined; }
}

function playAudio(text) {
  if (!text) return;
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' +
    encodeURIComponent(text) + '&tl=en&client=tw-ob';
  try { new Audio(url).play(); } catch (e) {}
}

// Setup Data
const MODES = [
  { id: 'sentence', label: 'Câu' },
  { id: 'paragraph', label: 'Đoạn văn' },
  { id: 'ielts', label: 'IELTS' }
];

const LEVELS = [
  { id: 'beginner', title: 'Cơ bản', desc: 'Dành cho người mới bắt đầu' },
  { id: 'intermediate', title: 'Trung cấp', desc: 'Giao tiếp cơ bản và công việc' },
  { id: 'advanced', title: 'Nâng cao', desc: 'Sử dụng ngôn ngữ tự nhiên, phức tạp' }
];

const SENTENCE_CATEGORIES = [
  'Personal & Communication', 'Everyday Life', 'Transportation & Travel', 'School & Education',
  'Work & Business', 'Public Services', 'Health & Medicine', 'Shopping & Money', 'Food & Drink',
  'Entertainment & Leisure', 'Nature & Environment', 'Science & Technology', 'Culture & Society',
  'Government & Politics', 'History & Geography', 'Sports & Fitness', 'Arts & Literature',
  'Religion & Spirituality', 'Law & Justice', 'Philosophy & Ethics'
];

const PARAGRAPH_CATEGORIES = ['Emails', 'Diaries', 'Essays', 'Articles', 'Stories', 'Reports'];

const IELTS_TYPES = [
  { id: 'opinion', label: 'Ý kiến' },
  { id: 'discussion', label: 'Thảo luận' },
  { id: 'problem_solution', label: 'Vấn đề - Giải pháp' },
  { id: 'advantage_disadvantage', label: 'Lợi - Hại' },
  { id: 'two_part', label: '2 phần' },
];

export default function WritingPractice() {
  const [screen, setScreen] = useState('setup'); // setup, practice, summary
  const [mode, setMode] = useState('sentence');
  const [level, setLevel] = useState('beginner');
  const [category, setCategory] = useState('');
  
  const [lesson, setLesson] = useState(null);
  const [answers, setAnswers] = useState({});
  const [grades, setGrades] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Dictionary & Hint states
  const [dictOpen, setDictOpen] = useState(false);
  const [dictWords, setDictWords] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);
  
  const [hintPopover, setHintPopover] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  
  // IELTS setup states
  const [ieltsTask, setIeltsTask] = useState('task2');
  const [ieltsType, setIeltsType] = useState('opinion');
  const [showOutline, setShowOutline] = useState(true);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);

  const fetchProgress = async () => {
    try {
      const email = getEmail();
      const res = await fetch('http://127.0.0.1:8000/api/writing/progress' +
        (email ? `?email=${encodeURIComponent(email)}` : ''));
      if (res.ok) setProgress(await res.json());
    } catch (e) { /* progress is non-critical */ }
  };

  useEffect(() => { fetchProgress(); }, []);

  const logAttempt = async ({ mode, level, category, task, score, num_items }) => {
    try {
      await fetch('http://127.0.0.1:8000/api/writing/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_email: getEmail(), mode, level, category: category || '',
          task: task || '', score, num_items: num_items || 0,
        }),
      });
      fetchProgress();
    } catch (e) { /* logging is best-effort */ }
  };

  const [toast, setToast] = useState(null);
  const notify = (text, kind = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
    if (mode !== 'ielts' && !category) {
      notify('Vui lòng chọn chủ đề.', 'error');
      return;
    }
    setLoading(true);
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const email = getEmail();

      const res = await fetch('http://127.0.0.1:8000/api/writing/lessons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, level, category: mode === 'ielts' ? '' : category, topic: '',
          num_sentences: 10, owner_email: email, api_key: apiKey,
          ...(mode === 'ielts' && { task: ieltsTask }),
          ...(mode === 'ielts' && ieltsTask === 'task2' && { question_type: ieltsType })
        })
      });
      const data = await res.json();
      setLesson(data);
      setAnswers({});
      setGrades({});
      setCurrentIndex(0);
      setDictOpen(false);
      setHintPopover(null);
      setScreen('practice');
    } catch (e) {
      console.error(e);
      notify('Lỗi tạo bài tập', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSentence = async () => {
    const currentAns = answers[currentIndex] || '';
    if (!currentAns.trim()) return;

    setLoading(true);
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const currentVi = lesson.sentences[currentIndex].vi;
      const refEn = lesson.sentences[currentIndex].reference_en;
      const res = await fetch('http://127.0.0.1:8000/api/writing/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vi: currentVi,
          reference_en: refEn,
          user_en: currentAns,
          level,
          api_key: apiKey
        })
      });
      const data = await res.json();
      setGrades(prev => ({ ...prev, [currentIndex]: data }));
    } catch (e) {
      console.error(e);
      notify('Lỗi chấm điểm', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNextSentence = () => {
    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setHintPopover(null);
    } else {
      const gradeValues = Object.values(grades);
      const avg = gradeValues.length
        ? gradeValues.reduce((sum, g) => sum + (g.score || 0), 0) / gradeValues.length
        : 0;
      logAttempt({
        mode, level, category: lesson.category || category, task: mode === 'ielts' ? ieltsTask : '',
        score: Math.round(avg * 10) / 10, num_items: gradeValues.length,
      });
      setScreen('summary');
    }
  };

  const openDictionary = async () => {
    setDictLoading(true);
    setDictOpen(true);
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const text = lesson.sentences.map(s => s.reference_en).join(' ');
      const res = await fetch('http://127.0.0.1:8000/api/writing/vocab_bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, api_key: apiKey })
      });
      const data = await res.json();
      setDictWords(data.words);
    } catch (e) {
      console.error(e);
      notify('Lỗi tra từ điển', 'error');
      setDictOpen(false);
    } finally {
      setDictLoading(false);
    }
  };

  const showHint = async () => {
    setHintLoading(true);
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const text = lesson.sentences[currentIndex].reference_en;
      const res = await fetch('http://127.0.0.1:8000/api/writing/vocab_bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, api_key: apiKey })
      });
      const data = await res.json();
      if (data.words && data.words.length > 0) {
        setHintPopover(data.words[0]);
      } else {
        notify('Không tìm thấy gợi ý', 'error');
      }
    } catch (e) {
      console.error(e);
      notify('Lỗi tải gợi ý', 'error');
    } finally {
      setHintLoading(false);
    }
  };

  const handleSaveFlashcards = async () => {
    setLoading(true);
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const textToSave = Object.values(grades).map(g => g.corrected).join('\n');
      
      const res = await fetch('http://127.0.0.1:8000/api/generate_flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_or_text: textToSave,
          api_key: apiKey
        })
      });
      if (res.ok) {
        notify('Đã lưu vào bộ Flashcards');
      }
    } catch (e) {
      console.error(e);
      notify('Lỗi lưu Flashcards', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWord = async (wordObj) => {
    try {
      await fetch('http://127.0.0.1:8000/api/vocabulary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: wordObj.word,
          meaning_vi: wordObj.meaning_vi,
          ipa: wordObj.ipa,
          part_of_speech: wordObj.part_of_speech,
          example_en: wordObj.example_en,
          example_vi: '',
          owner_email: getEmail(),
          api_key: localStorage.getItem('workflow_api_key') || ''
        })
      });
      notify('Đã lưu vào từ vựng');
    } catch (e) {
      console.error(e);
      notify('Lỗi lưu từ vựng', 'error');
    }
  };

  // ----------------------------------------------------
  // Render functions
  // ----------------------------------------------------
  const renderSetup = () => {
    const statBox = (label, value) => (
      <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8A334C' }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    );
    const weakCats = (progress?.categories || []).filter(c => c.avg_score < 8).slice(0, 3);
    return (
      <div>
        <h1 style={{ marginBottom: '8px', color: 'var(--text-navy)' }}>Luyện viết</h1>
        <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
          Luyện dịch Việt → Anh với AI chấm điểm từng câu.
        </div>

        {/* Persisted progress panel */}
        <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', padding: '8px', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex' }}>
            {statBox('⭐ Điểm', progress?.total_points ?? 0)}
            {statBox('🔥 Chuỗi ngày', progress?.streak ?? 0)}
            {statBox('Buổi học', progress?.sessions ?? 0)}
            {statBox('Điểm TB', progress?.avg_score ?? 0)}
          </div>
          {weakCats.length > 0 && (
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-light)' }}>
              Cần luyện thêm: {weakCats.map(c => `${c.category} (${c.avg_score})`).join(' · ')}
            </div>
          )}
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setCategory(''); }}
              style={{
                padding: '8px 16px',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                backgroundColor: mode === m.id ? '#8A334C' : 'var(--bg-tertiary)',
                color: mode === m.id ? '#fff' : 'var(--text-primary)'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Level Selector */}
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

        {mode === 'ielts' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            {[{ id: 'task1', label: 'Task 1 (Biểu đồ)' }, { id: 'task2', label: 'Task 2 (Luận)' }].map(t => (
              <button
                key={t.id}
                onClick={() => setIeltsTask(t.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '24px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  backgroundColor: ieltsTask === t.id ? '#8A334C' : 'var(--bg-tertiary)',
                  color: ieltsTask === t.id ? '#fff' : 'var(--text-primary)'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {mode === 'ielts' && ieltsTask === 'task2' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {IELTS_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setIeltsType(t.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: ieltsType === t.id ? '#8A334C' : 'transparent',
                  color: ieltsType === t.id ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: ieltsType === t.id ? 600 : 400
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Category Selector */}
        {mode !== 'ielts' && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Chủ đề</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(mode === 'sentence' ? SENTENCE_CATEGORIES : PARAGRAPH_CATEGORIES).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: category === cat ? '#8A334C' : 'transparent',
                    color: category === cat ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          style={{
            backgroundColor: '#8A334C',
            color: '#fff',
            borderRadius: '24px',
            padding: '12px 24px',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Bắt đầu
        </button>
      </div>
    );
  };

  const renderPractice = () => {
    if (!lesson) return null;

    const numGradedGood = Object.values(grades).filter(g => g.is_good).length;
    const progressWidth = lesson.sentences.length ? (numGradedGood / lesson.sentences.length) * 100 : 0;
    const currentGrade = grades[currentIndex];

    let accColor = '#EF4444';
    let accText = '—%';
    if (currentGrade && currentGrade.accuracy !== undefined) {
      accText = `${currentGrade.accuracy}%`;
      if (currentGrade.accuracy >= 80) accColor = '#22C55E';
      else if (currentGrade.accuracy >= 50) accColor = '#F59E0B';
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 1) HEADER ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            {mode === 'ielts' ? 'Luyện IELTS — dịch bài mẫu' : 'Luyện dịch'}
          </h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            ⭐ {progress?.total_points ?? 0} · Câu {currentIndex + 1}/{lesson.sentences.length}
          </div>
        </div>
        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${progressWidth}%`, height: '100%', backgroundColor: '#8A334C', transition: 'width 0.3s ease' }} />
        </div>

        {/* 2) QUESTION */}
        {lesson.ielts_prompt && (
          <div style={{ padding: '16px', backgroundColor: 'rgba(138, 51, 76, 0.05)', border: '1px solid #D6C5B3', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#8A334C' }}>Đề bài: {lesson.ielts_prompt}</div>
            
            {lesson.structure_hint && lesson.structure_hint.length > 0 && (
              <div style={{ border: '1px solid var(--border-medium)', borderRadius: '8px', overflow: 'hidden' }}>
                <div 
                  style={{ padding: '8px 12px', backgroundColor: '#fafaf9', borderBottom: showOutline ? '1px solid var(--border-medium)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#8A334C', fontWeight: 600, fontSize: '0.9rem' }}
                  onClick={() => setShowOutline(!showOutline)}
                >
                  <span>Dàn ý</span>
                  <span>{showOutline ? '▲' : '▼'}</span>
                </div>
                {showOutline && (
                  <div style={{ padding: '12px', backgroundColor: '#fff' }}>
                    <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {lesson.structure_hint.map((hint, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{hint}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3) TWO-COLUMN BODY */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* LEFT column */}
          <div style={{ flex: '1 1 300px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', maxHeight: '400px', overflowY: 'auto', lineHeight: 1.9 }}>
            {lesson.sentences.map((s, i) => {
              if (i < currentIndex) {
                return <span key={i} style={{ color: 'var(--text-primary)' }}>{(grades[i]?.corrected || answers[i] || s.reference_en)} </span>;
              } else if (i === currentIndex) {
                return <span key={i} style={{ color: '#8A334C', fontWeight: 700 }}>{s.vi} </span>;
              } else {
                return <span key={i} style={{ color: 'var(--text-muted)' }}>{s.vi} </span>;
              }
            })}
          </div>

          {/* RIGHT column */}
          <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={openDictionary}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Từ điển
            </button>

            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: accColor }}>{accText}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Độ chính xác</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#fff', flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Nhận xét</div>
              {!currentGrade ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nhấn Kiểm tra để nhận nhận xét từ AI.</div>
              ) : currentGrade.is_good ? (
                <div>
                  <div style={{ color: '#22C55E', fontWeight: 600, marginBottom: '8px' }}>✓ Bản dịch tốt!</div>
                  <div style={{ fontSize: '0.9rem' }}>{currentGrade.tip_vi}</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Gợi ý: </strong>
                    <span>{currentGrade.suggestion}</span>
                    <button onClick={() => playAudio(currentGrade.suggestion)} style={{ background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle', marginLeft: '4px' }}>
                      <Volume2 size={16} color="#8A334C" />
                    </button>
                  </div>
                  {currentGrade.improvements && currentGrade.improvements.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Cần cải thiện:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                        {currentGrade.improvements.map((imp, idx) => <li key={idx}>{imp}</li>)}
                      </ul>
                    </div>
                  )}
                  {currentGrade.tip_vi && (
                    <div style={{ color: '#F59E0B' }}>⚠️ {currentGrade.tip_vi}</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <div>🔥 {progress?.streak ?? 0} Chuỗi ngày</div>
              <div>💡 Chăm chỉ</div>
            </div>
          </div>
        </div>

        {/* 4) TEXTAREA */}
        <textarea
          rows={3}
          value={answers[currentIndex] || ''}
          onChange={(e) => setAnswers(prev => ({ ...prev, [currentIndex]: e.target.value }))}
          placeholder="Nhập bản dịch tiếng Anh cho câu đang chọn..."
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontFamily: 'inherit', resize: 'vertical' }}
        />

        {/* 5) BOTTOM ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setScreen('setup')}
            style={{ padding: '10px 20px', borderRadius: '24px', border: '1px solid var(--border-medium)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Thoát
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={showHint}
              disabled={hintLoading}
              style={{ padding: '10px 20px', borderRadius: '24px', border: '1px solid #8A334C', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600, color: '#8A334C' }}
            >
              {hintLoading ? 'Đang tải...' : 'Gợi ý'}
            </button>
            
            {(!currentGrade || !currentGrade.is_good) ? (
              <button
                onClick={handleCheckSentence}
                disabled={!(answers[currentIndex] || '').trim() || loading}
                style={{ padding: '10px 24px', borderRadius: '24px', border: 'none', backgroundColor: (answers[currentIndex] || '').trim() ? '#8A334C' : 'var(--border-medium)', cursor: (answers[currentIndex] || '').trim() ? 'pointer' : 'not-allowed', fontWeight: 600, color: '#fff' }}
              >
                {loading ? 'Đang xử lý...' : 'Kiểm tra'}
              </button>
            ) : (
              <button
                onClick={handleNextSentence}
                style={{ padding: '10px 24px', borderRadius: '24px', border: 'none', backgroundColor: '#8A334C', cursor: 'pointer', fontWeight: 600, color: '#fff' }}
              >
                {currentIndex < lesson.sentences.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
              </button>
            )}
          </div>
        </div>

      </div>
    );
  };

  const renderSummary = () => {
    const gradeValues = Object.values(grades);
    const countGood = gradeValues.filter(g => g.is_good).length;
    const avgAcc = gradeValues.length ? Math.round(gradeValues.reduce((s, g) => s + (g.accuracy || 0), 0) / gradeValues.length) : 0;

    return (
      <div>
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Kết quả</h2>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Độ chính xác: {avgAcc}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Số câu tốt: {countGood}/{lesson.sentences.length}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          {lesson.sentences.map((s, idx) => {
            const g = grades[idx];
            return (
              <div key={idx} style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Câu {idx + 1}: {s.vi}</div>
                {g && (
                  <>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Độ chính xác: <span style={{ color: g.accuracy >= 80 ? '#22C55E' : g.accuracy >= 50 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>{g.accuracy}%</span>
                    </div>
                    <div style={{ marginBottom: '8px' }}><strong>Dịch:</strong> {answers[idx] || ''}</div>
                    <div><strong>Gợi ý/Tham khảo:</strong> {g.corrected || s.reference_en}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => setScreen('setup')}
            style={{
              backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '24px',
              padding: '10px 20px', border: '1px solid var(--border-medium)', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Làm lại
          </button>
          <button
            onClick={handleSaveFlashcards}
            style={{
              backgroundColor: '#8A334C', color: '#fff', borderRadius: '24px',
              padding: '10px 20px', border: 'none', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Lưu từ vựng vào Flashcards
          </button>
        </div>
      </div>
    );
  };

  const renderDictionaryModal = () => {
    if (!dictOpen) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0 }}>Từ điển bài học</h3>
            <button onClick={() => setDictOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="var(--text-muted)" />
            </button>
          </div>
          <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dictLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Đang tải...</div>
            ) : dictWords && dictWords.length > 0 ? (
              dictWords.map((w, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{w.word}</strong>
                      <button onClick={() => playAudio(w.word)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        <Volume2 size={16} color="#8A334C" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveWord(w)}
                      style={{ backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: '16px', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      ＋ Lưu
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', marginBottom: '8px' }}>
                    {w.part_of_speech && <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>{w.part_of_speech}</span>}
                    {w.ipa && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{w.ipa}</span>}
                  </div>
                  <div style={{ fontWeight: 500, marginBottom: '8px' }}>{w.meaning_vi}</div>
                  {w.example_en && (
                    <div style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.9rem' }}>
                      <div>{w.example_en}</div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Không có dữ liệu từ vựng.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHintPopover = () => {
    if (!hintPopover) return null;
    return (
      <div style={{
        position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '320px', backgroundColor: '#fff', borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 300, padding: '16px',
        border: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#000' }}>{hintPopover.word}</span>
            <button
              onClick={() => playAudio(hintPopover.word)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <Volume2 size={16} color="#8A334C" />
            </button>
          </div>
          <button
            onClick={() => setHintPopover(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} color="var(--text-muted)" />
          </button>
        </div>
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            {hintPopover.part_of_speech && <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>{hintPopover.part_of_speech}</span>}
            {hintPopover.ipa && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{hintPopover.ipa}</span>}
          </div>
          {hintPopover.meaning_vi && (
            <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '8px', color: '#000' }}>
              {hintPopover.meaning_vi}
            </div>
          )}
          <button
            onClick={() => handleSaveWord(hintPopover)}
            style={{
              backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: '16px',
              padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: '8px'
            }}
          >
            ＋ Lưu vào từ vựng
          </button>
          {hintPopover.example_en && (
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.9rem', color: '#000' }}>{hintPopover.example_en}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px' }}>
      {screen === 'setup' && renderSetup()}
      {screen === 'practice' && renderPractice()}
      {screen === 'summary' && renderSummary()}

      {renderDictionaryModal()}
      {renderHintPopover()}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: toast.kind === 'error' ? '#EF4444' : '#22C55E', color: '#fff',
          padding: '12px 24px', borderRadius: '24px', fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 2000
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
