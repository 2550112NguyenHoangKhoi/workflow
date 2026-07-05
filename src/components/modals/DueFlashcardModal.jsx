import React, { useState, useEffect } from 'react';
import { X, Calendar, ArrowRight, Check, Download } from 'lucide-react';

const DueFlashcardModal = ({ isOpen, onClose }) => {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for the current card's spaced repetition metadata
  const [cardStates, setCardStates] = useState({});

  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadCards();
    } else {
      setCards([]);
      setError(null);
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [isOpen]);

  const loadCards = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const matchDoc = window.location.hash.match(/#\/document\/([^/]+)/);
      const matchProj = window.location.hash.match(/#\/project\/([^/]+)/);
      const docId = matchDoc ? parseInt(matchDoc[1], 10) : null;
      const projId = matchProj ? parseInt(matchProj[1], 10) : null;

      let url = 'http://127.0.0.1:8000/api/flashcards/due';
      const params = [];
      if (projId) {
        params.push(`project_id=${projId}`);
      }
      
      let finalDocId = docId;
      if (!finalDocId) {
        const storedId = sessionStorage.getItem('active_document_id');
        if (storedId) {
          finalDocId = parseInt(storedId, 10);
        }
      }
      if (finalDocId) {
        params.push(`document_id=${finalDocId}`);
      }

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setCards(data.flashcards || []);
      
      // Initialize SM-2 states for each card
      const initialStates = {};
      (data.flashcards || []).forEach((card, idx) => {
        initialStates[idx] = {
          id: card.id,
          interval: card.interval ?? 1,
          ease: card.ease ?? 2.5,
          repetitions: card.repetitions ?? 0,
          due: card.due_date ?? new Date().toISOString().split('T')[0]
        };
      });
      setCardStates(initialStates);
    } catch (err) {
      console.error(err);
      setError("Không thể tải thẻ cần ôn tập.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitReview = async (quality) => {
    try {
      const currentState = cardStates[currentIndex];
      const response = await fetch('http://127.0.0.1:8000/api/flashcards/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentState, quality })
      });
      const newState = await response.json();
      
      setCardStates(prev => ({ ...prev, [currentIndex]: newState }));
      
      // Move to next card
      setTimeout(() => {
        setIsFlipped(false);
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(curr => curr + 1);
        } else {
          // Finished all due cards
          setCurrentIndex(curr => curr + 1); // Will trigger the "All done" screen
        }
      }, 500);
      
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const currentState = cardStates[currentIndex];
  
  const isFinished = currentIndex >= cards.length && cards.length > 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(27, 42, 78, 0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: '#FAFAFA', borderRadius: '24px', width: '90%', maxWidth: '600px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-navy)', fontWeight: 800 }}>Daily Review</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Spaced Repetition (SM-2)</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '300px' }}>
          {isLoading ? (
            <div style={{ margin: 'auto', color: 'var(--brand-primary)', fontWeight: 600 }}>Loading due flashcards...</div>
          ) : error ? (
            <div style={{ margin: 'auto', color: 'red', fontWeight: 600 }}>{error}</div>
          ) : isFinished ? (
            <div style={{ margin: 'auto', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', backgroundColor: '#D1FAE5', color: '#059669', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Check size={40} />
              </div>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-navy)', fontWeight: 800, marginBottom: '8px' }}>You're all caught up!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Excellent work! You have reviewed all your due flashcards for today.</p>
              <button onClick={onClose} style={{ padding: '12px 32px', backgroundColor: 'var(--brand-primary)', color: 'white', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Hoàn Thành
              </button>
            </div>
          ) : cards.length > 0 ? (
            <>
              <div style={{ width: '100%', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>
                <span>Card {currentIndex + 1} of {cards.length}</span>
                {currentState && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> Due: {currentState.due}
                  </span>
                )}
              </div>
              
              {/* Flashcard Body */}
              <div 
                onClick={() => setIsFlipped(true)}
                style={{
                  width: '100%', minHeight: '200px', backgroundColor: 'var(--bg-tertiary)', border: '2px solid var(--border-medium)',
                  borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: isFlipped ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}
              >
                {!isFlipped ? (
                  <h3 style={{ fontSize: '1.5rem', color: 'var(--text-navy)', fontWeight: 700, margin: 0 }}>{currentCard?.front}</h3>
                ) : (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '16px', opacity: 0.7 }}>{currentCard?.front}</h3>
                    <div style={{ height: '1px', width: '40px', backgroundColor: 'var(--border-medium)', margin: '0 auto 16px' }} />
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-navy)', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{currentCard?.back}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: '32px', width: '100%', display: 'flex', justifyContent: 'center', gap: '16px', opacity: isFlipped ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: isFlipped ? 'auto' : 'none' }}>
                <button onClick={() => submitReview(1)} style={{ flex: 1, padding: '12px', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Hard (1)
                </button>
                <button onClick={() => submitReview(3)} style={{ flex: 1, padding: '12px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Good (3)
                </button>
                <button onClick={() => submitReview(5)} style={{ flex: 1, padding: '12px', backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Easy (5)
                </button>
              </div>
              
              {!isFlipped && (
                <div style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
                  Click card to reveal answer
                </div>
              )}
            </>
          ) : (
            <div style={{ margin: 'auto', color: 'var(--text-secondary)', textAlign: 'center' }}>
              <div style={{ marginBottom: '16px' }}><Check size={48} color="var(--border-medium)" /></div>
              <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>Tất cả đều ổn!</div>
              <div style={{ fontSize: '0.9rem' }}>Bạn không có thẻ nào cần ôn tập hôm nay.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DueFlashcardModal;
