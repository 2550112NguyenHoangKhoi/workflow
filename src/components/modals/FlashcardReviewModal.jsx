import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Download, Shuffle, Star, RotateCcw, Sparkles, Check } from 'lucide-react';

const FlashcardReviewModal = ({ isOpen, onClose }) => {
  const [cards, setCards] = useState([]);
  const [order, setOrder] = useState([]);        // indices into `cards`, for shuffle
  const [pos, setPos] = useState(0);              // position within `order`
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cardStates, setCardStates] = useState({});
  const [reviewed, setReviewed] = useState({});   // cardIndex -> 'hard'|'good'|'easy'
  const [starred, setStarred] = useState({});      // cardIndex -> true
  const [activeDoc, setActiveDoc] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const currentIndex = order[pos];

  useEffect(() => {
    if (isOpen) {
      setDone(false); setPos(0); setIsFlipped(false); setReviewed({}); setStarred({});
      const matchDoc = window.location.hash.match(/#\/document\/([^/]+)/);
      const matchProj = window.location.hash.match(/#\/project\/([^/]+)/);
      const docId = matchDoc ? parseInt(matchDoc[1], 10) : null;
      const projId = matchProj ? parseInt(matchProj[1], 10) : null;

      let url = 'http://127.0.0.1:8000/api/documents';
      if (projId) {
        url += `?project_id=${projId}`;
      }

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.documents && data.documents.length > 0) {
            let doc = data.documents[data.documents.length - 1];
            if (docId) {
              const found = data.documents.find(d => d.id === docId);
              if (found) doc = found;
            } else {
              const storedId = sessionStorage.getItem('active_document_id');
              if (storedId) {
                const found = data.documents.find(d => String(d.id) === String(storedId));
                if (found) doc = found;
              }
            }
            setActiveDoc(doc);
            loadCards(doc.content, doc.id, projId || doc.project_id);
          } else {
            setError("Chưa có tài liệu. Vui lòng Upload tài liệu trước!");
          }
        })
        .catch(err => setError(err.message));
    } else {
      setCards([]); setOrder([]); setError(null); setPos(0); setIsFlipped(false);
    }
  }, [isOpen]);

  const loadCards = async (textContent, documentId, projectId) => {
    setIsLoading(true); setError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/generate_flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_or_text: textContent,
          project_id: projectId ? parseInt(projectId, 10) : null,
          document_id: documentId ? parseInt(documentId, 10) : null,
          api_key: localStorage.getItem('workflow_api_key') || ''
        })
      });
      const data = await response.json();
      const list = data.flashcards || [];
      setCards(list);
      setOrder(list.map((_, i) => i));
      const initial = {};
      list.forEach((card, idx) => {
        initial[idx] = {
          id: card.id, interval: card.interval ?? 1, ease: card.ease ?? 2.5,
          repetitions: card.repetitions ?? 0, due: card.due_date ?? new Date().toISOString().split('T')[0]
        };
      });
      setCardStates(initial);
    } catch (err) {
      console.error(err); setError("Không tạo được flashcards.");
    } finally {
      setIsLoading(false);
    }
  };

  const go = useCallback((delta) => {
    setIsFlipped(false);
    setPos(p => {
      const next = p + delta;
      if (next >= order.length) { setDone(true); return p; }
      return Math.max(0, Math.min(order.length - 1, next));
    });
  }, [order.length]);

  const submitReview = useCallback(async (quality, label) => {
    const idx = order[pos];
    setReviewed(r => ({ ...r, [idx]: label }));
    const currentState = cardStates[idx];
    if (currentState) {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/flashcards/review', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...currentState, quality })
        });
        const newState = await res.json();
        setCardStates(prev => ({ ...prev, [idx]: newState }));
      } catch (err) { console.error(err); }
    }
    setTimeout(() => go(1), 180);
  }, [order, pos, cardStates, go]);

  const shuffle = useCallback(() => {
    setOrder(o => {
      const a = [...o];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    });
    setPos(0); setIsFlipped(false); setDone(false); setReviewed({});
  }, []);

  const restart = () => { setPos(0); setIsFlipped(false); setDone(false); setReviewed({}); };

  // Keyboard shortcuts (Anki/Quizlet-style)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (done || isLoading || !cards.length) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsFlipped(f => !f); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key.toLowerCase() === 's') { shuffle(); }
      else if (isFlipped && e.key === '1') submitReview(1, 'hard');
      else if (isFlipped && e.key === '2') submitReview(3, 'good');
      else if (isFlipped && e.key === '3') submitReview(5, 'easy');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, done, isLoading, cards.length, isFlipped, go, shuffle, submitReview]);

  const exportToCSV = () => {
    if (!cards.length) return;
    const csv = "front,back\n" + cards.map(c => `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}"`).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement("a");
    link.href = url; link.download = `Flashcards_${activeDoc?.filename || 'Export'}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const reviewedCount = Object.keys(reviewed).length;
  const progress = cards.length ? Math.round((reviewedCount / cards.length) * 100) : 0;
  const counts = Object.values(reviewed).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});

  const ratingBtn = (label, q, key, bg, color, border) => (
    <button onClick={() => submitReview(q, label === 'Khó' ? 'hard' : label === 'Tạm' ? 'good' : 'easy')}
      style={{ flex: 1, padding: '12px', backgroundColor: bg, color, border: `1px solid ${border}`, borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <span>{label}</span><span style={{ fontSize: '0.7rem', opacity: 0.7 }}>phím {key}</span>
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(27,42,78,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#FAFAFA', borderRadius: '24px', width: '92%', maxWidth: '640px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1B2A4E', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--brand-primary)" /> Flashcards
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeDoc?.filename || 'Spaced Repetition (SM-2)'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {cards.length > 0 && !done && (
              <>
                <button onClick={shuffle} title="Xáo trộn (S)" style={{ background: 'white', border: '1px solid var(--border-medium)', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', display: 'flex' }}><Shuffle size={16} /></button>
                <button onClick={exportToCSV} title="Xuất CSV (Anki/Quizlet)" style={{ background: '#E8F5E9', border: 'none', cursor: 'pointer', color: '#065F46', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}><Download size={16} /> CSV</button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={24} /></button>
          </div>
        </div>

        {/* Progress bar */}
        {cards.length > 0 && (
          <div style={{ height: '6px', backgroundColor: 'var(--border-light)' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--brand-secondary)', transition: 'width 0.3s ease' }} />
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '360px' }}>
          {isLoading ? (
            <div style={{ margin: 'auto', color: 'var(--brand-primary)', fontWeight: 600 }}>Đang tạo flashcards…</div>
          ) : error ? (
            <div style={{ margin: 'auto', color: '#B91C1C', fontWeight: 600, textAlign: 'center' }}>{error}</div>
          ) : done ? (
            <div style={{ margin: 'auto', textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Check size={36} color="#059669" /></div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1B2A4E', margin: '0 0 8px' }}>Hoàn thành bộ thẻ! 🎉</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>Đã ôn {reviewedCount}/{cards.length} thẻ</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px', fontSize: '0.85rem', fontWeight: 700 }}>
                <span style={{ color: '#991B1B' }}>Khó: {counts.hard || 0}</span>
                <span style={{ color: '#92400E' }}>Tạm: {counts.good || 0}</span>
                <span style={{ color: '#065F46' }}>Dễ: {counts.easy || 0}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={restart} style={{ padding: '12px 24px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '8px' }}><RotateCcw size={16} /> Ôn lại</button>
                <button onClick={shuffle} style={{ padding: '12px 24px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Shuffle size={16} /> Xáo trộn & ôn</button>
              </div>
            </div>
          ) : cards.length > 0 ? (
            <>
              {/* meta row */}
              <div style={{ width: '100%', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Thẻ {pos + 1} / {cards.length}</span>
                <button onClick={() => setStarred(s => ({ ...s, [currentIndex]: !s[currentIndex] }))} title="Đánh dấu" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: starred[currentIndex] ? '#F59E0B' : 'var(--text-muted)' }}>
                  <Star size={16} fill={starred[currentIndex] ? '#F59E0B' : 'none'} /> {starred[currentIndex] ? 'Đã đánh dấu' : 'Đánh dấu'}
                </button>
              </div>

              {/* 3D flip card */}
              <div style={{ perspective: '1600px', width: '100%', height: '230px' }}>
                <div onClick={() => setIsFlipped(f => !f)} style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'none', cursor: 'pointer' }}>
                  {/* Front */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', backgroundColor: 'white', border: '2px solid var(--border-medium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <span style={{ position: 'absolute', top: 12, left: 16, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>CÂU HỎI</span>
                    <h3 style={{ fontSize: '1.4rem', color: '#1B2A4E', fontWeight: 700, margin: 0 }}>{currentCard?.front}</h3>
                  </div>
                  {/* Back */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', backgroundColor: '#1B2A4E', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <span style={{ position: 'absolute', top: 12, left: 16, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>ĐÁP ÁN</span>
                    <p style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{currentCard?.back}</p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ marginTop: '20px', width: '100%' }}>
                {!isFlipped ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => go(-1)} disabled={pos === 0} style={{ background: 'white', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '12px', cursor: pos === 0 ? 'not-allowed' : 'pointer', opacity: pos === 0 ? 0.4 : 1, color: '#1B2A4E', display: 'flex' }}><ArrowLeft size={18} /></button>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, textAlign: 'center' }}>Nhấn <b>Space</b> để lật thẻ</div>
                    <button onClick={() => go(1)} style={{ background: 'white', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '12px', cursor: 'pointer', color: '#1B2A4E', display: 'flex' }}><ArrowRight size={18} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {ratingBtn('Khó', 1, '1', '#FEE2E2', '#991B1B', '#FCA5A5')}
                    {ratingBtn('Tạm', 3, '2', '#FEF3C7', '#92400E', '#FCD34D')}
                    {ratingBtn('Dễ', 5, '3', '#D1FAE5', '#065F46', '#6EE7B7')}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span>⌨ Space: lật</span><span>← →: chuyển thẻ</span><span>1/2/3: chấm điểm</span><span>S: xáo trộn</span>
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>Không có thẻ nào.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardReviewModal;
