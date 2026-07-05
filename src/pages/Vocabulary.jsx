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

export default function Vocabulary() {
  const [words, setWords] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [aiPrompting, setAiPrompting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [review, setReview] = useState(null);
  const [toast, setToast] = useState(null);
  const [importing, setImporting] = useState(false);
  const [bankTopics, setBankTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('b');
  
  const [lookupResult, setLookupResult] = useState(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const notify = (text, kind = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const vocab_limit = parseInt(localStorage.getItem('vocab_limit') || '10', 10);
  const vocab_wrong_limit = parseInt(localStorage.getItem('vocab_wrong_limit') || '3', 10);
  
  const [settingLimit, setSettingLimit] = useState(vocab_limit);
  const [settingWrongLimit, setSettingWrongLimit] = useState(vocab_wrong_limit);

  const fetchWords = async () => {
    try {
      const email = getEmail() || '';
      const res = await fetch(`http://127.0.0.1:8000/api/vocabulary/list?email=${encodeURIComponent(email)}&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setWords(data.words);
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const email = getEmail() || '';
      const res = await fetch(`http://127.0.0.1:8000/api/vocabulary/stats?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchWords();
    setLookupResult(null);
    
    if (query.trim().length > 1) {
      setIsLookingUp(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/vocabulary/lookup?word=${encodeURIComponent(query.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setLookupResult(data);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsLookingUp(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsLookingUp(false);
    }
    // eslint-disable-next-line
  }, [query]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line
  }, []);

  const fetchBankTopics = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/vocabulary/bank');
      if (res.ok) {
        const data = await res.json();
        setBankTopics(data.topics || []);
        if (data.topics && data.topics.length > 0) setSelectedTopic(data.topics[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBankTopics();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const res = await fetch('http://127.0.0.1:8000/api/vocabulary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: newWord.trim(),
          owner_email: getEmail(),
          api_key: apiKey
        })
      });
      if (res.ok) {
        setNewWord('');
        setAdding(false);
        fetchWords();
        fetchStats();
        notify('Đã thêm từ');
      }
    } catch (e) {
      notify('Lỗi thêm từ', 'error');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const apiKey = localStorage.getItem('workflow_api_key') || '';
      const res = await fetch('http://127.0.0.1:8000/api/vocabulary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          owner_email: getEmail(),
          api_key: apiKey
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiPrompt('');
        setAiPrompting(false);
        fetchWords();
        fetchStats();
        notify(`Đã tạo thành công ${data.added} từ vựng từ AI`);
      } else {
        const err = await res.json();
        notify(err.detail || 'Lỗi tạo từ', 'error');
      }
    } catch (e) {
      notify('Lỗi gọi API', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedTopic) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/vocabulary/bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic,
          level: selectedLevel,
          owner_email: getEmail()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setImporting(false);
        fetchWords();
        fetchStats();
        notify(`Đã thêm ${data.added} từ mới, bỏ qua ${data.skipped || 0} từ trùng`);
      }
    } catch (e) {
      notify('Lỗi nhập từ', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/vocabulary/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWords();
        fetchStats();
      }
    } catch (e) {
      notify('Lỗi xoá từ', 'error');
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('vocab_limit', settingLimit.toString());
    localStorage.setItem('vocab_wrong_limit', settingWrongLimit.toString());
    notify('Đã lưu');
  };

  const startReview = async (type) => {
    try {
      const email = getEmail() || '';
      const limit = localStorage.getItem('vocab_limit') || '10';
      const res = await fetch(`http://127.0.0.1:8000/api/vocabulary/review?email=${encodeURIComponent(email)}&type=${type}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.words || data.words.length === 0) {
          notify('Không có từ để ôn', 'error');
          return;
        }
        setReview({
          words: data.words,
          idx: 0,
          revealed: false,
          correct: 0,
          wrong: 0,
          done: false
        });
      }
    } catch (e) {
      notify('Lỗi ôn tập', 'error');
    }
  };

  const gradeReview = async (correct) => {
    if (!review) return;
    const word = review.words[review.idx];
    try {
      await fetch('http://127.0.0.1:8000/api/vocabulary/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: word.id,
          correct: correct,
          owner_email: getEmail()
        })
      });
    } catch (e) {}

    const newCorrect = review.correct + (correct ? 1 : 0);
    const newWrong = review.wrong + (!correct ? 1 : 0);
    const wLimit = parseInt(localStorage.getItem('vocab_wrong_limit') || '3', 10);
    
    let isDone = false;
    if (newWrong >= wLimit) {
      isDone = true;
    } else if (review.idx + 1 >= review.words.length) {
      isDone = true;
    }

    setReview(prev => ({
      ...prev,
      idx: prev.idx + 1,
      correct: newCorrect,
      wrong: newWrong,
      revealed: false,
      done: isDone
    }));
  };

  const closeReview = () => {
    setReview(null);
    fetchWords();
    fetchStats();
  };

  const renderReview = () => {
    if (!review) return null;
    const { words, idx, revealed, correct, wrong, done } = review;

    if (done) {
      const points = correct * 10 + wrong * 2;
      return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--text-navy)' }}>Kết quả ôn tập</h2>
            <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Đúng {correct} / {correct + wrong}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#8A334C', marginBottom: '24px' }}>+{points} điểm</div>
            <button onClick={closeReview} style={{ backgroundColor: '#8A334C', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '24px', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
              Đóng
            </button>
          </div>
        </div>
      );
    }

    const word = words[idx];
    if (!word) return null;

    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Từ {idx + 1} / {words.length}</div>
          <button onClick={closeReview} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Thoát</button>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#8A334C', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
              {word.word}
              <button onClick={() => playAudio(word.word)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Volume2 size={32} color="#8A334C" /></button>
            </div>
            {word.ipa && <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '8px' }}>{word.ipa}</div>}
          </div>

          {!revealed ? (
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '400px' }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Bạn có nhớ nghĩa của từ này không?</div>
              <button onClick={() => setReview(prev => ({...prev, revealed: true}))} style={{ width: '100%', padding: '16px', borderRadius: '24px', backgroundColor: 'var(--brand-primary)', color: '#fff', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}>
                Hiện nghĩa
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s' }}>
              <div style={{ padding: '24px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', marginBottom: '32px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px' }}>{word.meaning_vi}</div>
                {word.example_en && <div style={{ fontSize: '1rem', fontStyle: 'italic', marginBottom: '4px' }}>{word.example_en}</div>}
                {word.example_vi && <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{word.example_vi}</div>}
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => gradeReview(false)} style={{ flex: 1, padding: '16px', borderRadius: '24px', backgroundColor: 'transparent', color: '#EF4444', border: '2px solid #EF4444', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}>
                  ❌ Chưa nhớ
                </button>
                <button onClick={() => gradeReview(true)} style={{ flex: 1, padding: '16px', borderRadius: '24px', backgroundColor: '#22C55E', color: '#fff', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}>
                  ✅ Tôi nhớ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '980px', margin: '0 auto', padding: '32px 24px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0, color: 'var(--text-navy)' }}>Từ vựng của tôi</h1>
        {stats && (
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#F59E0B' }}>⭐ {stats.points} điểm</span> · {stats.learned} đã thuộc / {stats.total} từ
          </div>
        )}
      </div>

      {stats && (
        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '32px', overflow: 'hidden' }}>
          <div style={{ width: `${stats.completion}%`, height: '100%', backgroundColor: '#8A334C', transition: 'width 0.5s' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        
        {/* MAIN (left) */}
        <div style={{ flex: '1 1 500px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input 
              type="text" 
              placeholder="Tìm từ..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)', fontSize: '1rem' }}
            />
            <button 
              onClick={() => { setAdding(!adding); setImporting(false); setAiPrompting(false); }}
              style={{ padding: '0 20px', backgroundColor: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ＋ Thêm từ
            </button>
            <button 
              onClick={() => { setImporting(!importing); setAdding(false); setAiPrompting(false); }}
              style={{ padding: '0 20px', backgroundColor: '#fff', color: '#8A334C', border: '1px solid #8A334C', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              📥 Từ bộ có sẵn
            </button>
            <button 
              onClick={() => { setAiPrompting(!aiPrompting); setAdding(false); setImporting(false); }}
              style={{ padding: '0 20px', backgroundColor: '#fff', color: '#8A334C', border: '1px solid #8A334C', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ✨ Tạo bằng AI
            </button>
          </div>

          {aiPrompting && (
            <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(138,51,76,0.05)', border: '1px solid #8A334C', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Nhập chủ đề (VD: Kinh doanh, Động vật, IELTS...)" 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{ flex: 1, minWidth: '200px', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '1rem' }}
              />
              <button 
                type="submit" 
                disabled={isGenerating}
                style={{ padding: '10px 24px', backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {isGenerating ? 'Đang tạo...' : 'Tạo'}
              </button>
            </form>
          )}

          {importing && (
            <form onSubmit={handleImport} style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <select 
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{ flex: 1, minWidth: '150px', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '1rem', backgroundColor: '#fff' }}
              >
                {bankTopics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select 
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                style={{ width: '150px', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '1rem', backgroundColor: '#fff' }}
              >
                <option value="b">Cơ bản (A1-A2)</option>
                <option value="i">Trung cấp (B1-B2)</option>
                <option value="a">Cao cấp (C1-C2)</option>
              </select>
              <button type="submit" style={{ padding: '0 20px', backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Nhập
              </button>
            </form>
          )}

          {adding && (
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px' }}>
              <input 
                type="text" 
                placeholder="Nhập từ tiếng Anh mới..." 
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                autoFocus
                style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '1rem' }}
              />
              <button type="submit" style={{ padding: '0 20px', backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Thêm
              </button>
            </form>
          )}

          {isLookingUp && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              Đang tra từ điển...
            </div>
          )}

          {lookupResult && !words.find(w => (w.word || "").toLowerCase() === lookupResult.word.toLowerCase()) && (
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-medium)', backgroundColor: '#fff', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-navy)' }}>{lookupResult.word}</span>
                    <button onClick={() => playAudio(lookupResult.word)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><Volume2 size={20} color="#8A334C" /></button>
                    {lookupResult.ipa && <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{lookupResult.ipa}</span>}
                    {lookupResult.part_of_speech && <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{lookupResult.part_of_speech}</span>}
                    {lookupResult.grammar && <span style={{ color: '#6B7280', fontSize: '0.9rem', fontStyle: 'italic', marginLeft: '4px' }}>{lookupResult.grammar}</span>}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '8px' }}>{lookupResult.meaning_vi}</div>
                  {lookupResult.example_en && (
                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '12px' }}>
                      <div style={{ fontStyle: 'italic' }}>{lookupResult.example_en}</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{lookupResult.example_vi}</div>
                    </div>
                  )}
                  {lookupResult.synonyms && lookupResult.synonyms.length > 0 && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <strong>Đồng nghĩa: </strong> {lookupResult.synonyms.join(', ')}
                    </div>
                  )}
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch('http://127.0.0.1:8000/api/vocabulary/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          word: lookupResult.word,
                          meaning_vi: lookupResult.meaning_vi,
                          ipa: lookupResult.ipa,
                          part_of_speech: lookupResult.part_of_speech,
                          example_en: lookupResult.example_en,
                          example_vi: lookupResult.example_vi,
                          owner_email: getEmail(),
                          api_key: localStorage.getItem('workflow_api_key') || ''
                        })
                      });
                      if (res.ok) {
                        setQuery(''); // clear query to show list
                        fetchWords();
                        fetchStats();
                        notify('Đã thêm từ: ' + lookupResult.word);
                      }
                    } catch (e) {
                      notify('Lỗi thêm từ', 'error');
                    }
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#8A334C', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  + Thêm từ này
                </button>
              </div>
            </div>
          )}

          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '16px' }} 
            onClick={() => setIsListExpanded(!isListExpanded)}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-navy)' }}>Danh sách từ vựng của bạn ({words.length} từ)</span>
            <span style={{ transform: isListExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </div>

          {isListExpanded && (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
              {words.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: '16px' }}>Chưa có từ nào. Hãy thêm từ mới để bắt đầu.</div>
                  {suggestions.length > 0 && query.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <div style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Có thể bạn muốn tìm:</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => setQuery(s)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              borderRadius: '16px',
                              cursor: 'pointer',
                              color: '#4b5563',
                              fontSize: '0.9rem'
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {words.map(w => (
                    <div key={w.id} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
                      <button onClick={() => handleDelete(w.id)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{w.word}</span>
                        <button onClick={() => playAudio(w.word)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><Volume2 size={18} color="#8A334C" /></button>
                        {w.ipa && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{w.ipa}</span>}
                        {w.part_of_speech && <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{w.part_of_speech}</span>}
                        {w.learned === 1 && <span style={{ backgroundColor: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>đã thuộc</span>}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '8px' }}>{w.meaning_vi}</div>
                      {w.example_en && (
                        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                          <div style={{ fontStyle: 'italic' }}>{w.example_en}</div>
                          {w.example_vi && <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{w.example_vi}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT column */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ padding: '20px', border: '1px solid var(--border-light)', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-navy)' }}>Thống kê học tập</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8A334C' }}>{stats?.completion || 0}%</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hoàn thành</div>
              </div>
              <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F59E0B' }}>🔥 {stats?.streak || 0}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chuỗi ngày</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '20px', border: '1px solid var(--border-light)', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-navy)' }}>Ôn tập</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => startReview('new_words')} style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#8A334C', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                Ôn từ mới
              </button>
              <button onClick={() => startReview('learned_words')} disabled={!stats?.learned} style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: stats?.learned ? '#fff' : 'var(--bg-primary)', color: stats?.learned ? '#8A334C' : 'var(--text-muted)', border: '1px solid var(--border-medium)', fontWeight: 600, cursor: stats?.learned ? 'pointer' : 'not-allowed' }}>
                Ôn từ đã thuộc
              </button>
            </div>
          </div>

          <div style={{ padding: '20px', border: '1px solid var(--border-light)', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-navy)' }}>Cài đặt ôn tập</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Số từ mỗi lượt</label>
                <input type="number" min="1" max="50" value={settingLimit} onChange={(e) => setSettingLimit(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-medium)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Giới hạn trả lời sai</label>
                <input type="number" min="1" max="10" value={settingWrongLimit} onChange={(e) => setSettingWrongLimit(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-medium)' }} />
              </div>
              <button onClick={handleSaveSettings} style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#fff', color: '#000', border: '1px solid var(--border-medium)', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
                Lưu cài đặt
              </button>
            </div>
          </div>

          <div style={{ padding: '20px', border: '1px solid var(--border-light)', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-navy)' }}>Thành tích</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {stats?.achievements?.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', opacity: a.unlocked ? 1 : 0.5 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: a.unlocked ? 'rgba(138,51,76,0.1)' : 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                    {a.unlocked ? '🏆' : '🔒'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: a.unlocked ? '#8A334C' : 'var(--text-primary)' }}>{a.title_vi}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.desc_vi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {renderReview()}

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
