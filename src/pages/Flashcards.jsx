import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { generateFlashcards } from '../utils/api';

const Flashcards = () => {
  const [topic, setTopic] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('workflow_flashcards');
    if (saved) {
      setFlashcards(JSON.parse(saved));
    }
  }, []);

  // Save to local storage when updated
  useEffect(() => {
    if (flashcards.length > 0) {
      localStorage.setItem('workflow_flashcards', JSON.stringify(flashcards));
    }
  }, [flashcards]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    
    const cards = await generateFlashcards(topic);
    if (cards && cards.length > 0) {
      setFlashcards(cards);
    }
    setIsGenerating(false);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your saved flashcards?')) {
      setFlashcards([]);
      localStorage.removeItem('workflow_flashcards');
      setTopic('');
    }
  };

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 className="text-3xl font-bold mb-2">Flashcards</h2>
          <p className="text-secondary">Generate smart study cards using AI or review your saved cards.</p>
        </div>
        {flashcards.length > 0 && (
          <button 
            onClick={handleClear}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '0.875rem' }}
          >
            <Trash2 size={16} /> Clear Saved
          </button>
        )}
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', display: 'flex', gap: '16px' }}>
        <input 
          type="text" 
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic (e.g., 'Photosynthesis' or paste document text)..."
          style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          style={{ 
            padding: '12px 24px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--brand-primary)', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: isGenerating ? 0.7 : 1
          }}
        >
          {isGenerating ? 'Generating...' : <><Sparkles size={18} /> Generate</>}
        </button>
      </div>

      {flashcards.length > 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ perspective: '1000px', width: '100%', maxWidth: '600px', height: '350px' }}>
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transition: 'transform 0.6s',
                transformStyle: 'preserve-3d',
                cursor: 'pointer',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front */}
              <div className="glass-card" style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
                backgroundColor: 'white'
              }}>
                <span style={{ position: 'absolute', top: '20px', left: '20px', color: 'var(--text-muted)', fontWeight: 600 }}>Q</span>
                <h3 className="text-2xl font-medium" style={{ color: 'var(--text-primary)' }}>
                  {flashcards[currentIndex].front}
                </h3>
                <span style={{ position: 'absolute', bottom: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Click to flip</span>
              </div>

              {/* Back */}
              <div className="glass-card" style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
                backgroundColor: 'var(--brand-primary)',
                color: 'white'
              }}>
                <span style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.7, fontWeight: 600 }}>A</span>
                <p className="text-xl" style={{ lineHeight: 1.6 }}>
                  {flashcards[currentIndex].back}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '32px' }}>
            <button 
              onClick={prevCard} 
              disabled={currentIndex === 0}
              style={{ padding: '12px', borderRadius: '50%', backgroundColor: currentIndex === 0 ? 'transparent' : 'var(--bg-secondary)', color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--brand-primary)', boxShadow: currentIndex === 0 ? 'none' : 'var(--shadow-sm)' }}
            >
              <ArrowLeft size={24} />
            </button>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {currentIndex + 1} / {flashcards.length}
            </span>
            <button 
              onClick={nextCard} 
              disabled={currentIndex === flashcards.length - 1}
              style={{ padding: '12px', borderRadius: '50%', backgroundColor: currentIndex === flashcards.length - 1 ? 'transparent' : 'var(--bg-secondary)', color: currentIndex === flashcards.length - 1 ? 'var(--text-muted)' : 'var(--brand-primary)', boxShadow: currentIndex === flashcards.length - 1 ? 'none' : 'var(--shadow-sm)' }}
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>
      ) : (
        !isGenerating && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Enter a topic above to generate your first deck of flashcards!
          </div>
        )
      )}
    </div>
  );
};

export default Flashcards;
