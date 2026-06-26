import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle2, XCircle } from 'lucide-react';
import { generateQuiz } from '../utils/api';

const Quizzes = () => {
  const [topic, setTopic] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('workflow_quiz');
    if (saved) setQuiz(JSON.parse(saved));
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    const newQuiz = await generateQuiz(topic);
    if (newQuiz) {
      setQuiz(newQuiz);
      localStorage.setItem('workflow_quiz', JSON.stringify(newQuiz));
      resetQuizState();
    }
    setIsGenerating(false);
  };

  const resetQuizState = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setScore(0);
  };

  const handleClear = () => {
    if (confirm('Clear your saved quiz?')) {
      setQuiz(null);
      localStorage.removeItem('workflow_quiz');
      setTopic('');
      resetQuizState();
    }
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    if (selectedOption === quiz.questions[currentQuestion].correct_option_id) {
      setScore(s => s + 1);
    }
    setIsSubmitted(true);
  };

  const handleNext = () => {
    setCurrentQuestion(q => q + 1);
    setSelectedOption(null);
    setIsSubmitted(false);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 className="text-3xl font-bold mb-2">Interactive Quizzes</h2>
          <p className="text-secondary">Test your knowledge with AI-generated multiple-choice questions.</p>
        </div>
        {quiz && (
          <button onClick={handleClear} style={{ color: '#EF4444', fontSize: '0.875rem' }}>Clear Saved</button>
        )}
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', display: 'flex', gap: '16px' }}>
        <input 
          type="text" 
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic or paste text..."
          style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'var(--brand-primary)', color: 'white', opacity: isGenerating ? 0.7 : 1 }}
        >
          {isGenerating ? 'Generating...' : 'Generate Quiz'}
        </button>
      </div>

      {quiz ? (
        currentQuestion < quiz.questions.length ? (
          <div className="glass-card" style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <span className="text-sm font-semibold color-brand">Question {currentQuestion + 1} of {quiz.questions.length}</span>
              <span className="text-sm font-semibold color-brand">Score: {score}</span>
            </div>
            
            <h3 className="text-2xl font-bold mb-8">{quiz.questions[currentQuestion].question}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {quiz.questions[currentQuestion].options.map(opt => {
                const isCorrect = opt.id === quiz.questions[currentQuestion].correct_option_id;
                const isSelected = selectedOption === opt.id;
                
                let bgColor = 'var(--bg-tertiary)';
                let borderColor = 'var(--border-light)';
                let textColor = 'var(--text-primary)';
                
                if (isSubmitted) {
                  if (isCorrect) {
                    bgColor = 'rgba(16, 185, 129, 0.1)';
                    borderColor = 'var(--accent-green)';
                  } else if (isSelected && !isCorrect) {
                    bgColor = 'rgba(239, 68, 68, 0.1)';
                    borderColor = '#EF4444';
                  }
                } else if (isSelected) {
                  borderColor = 'var(--brand-primary)';
                  bgColor = 'rgba(79, 70, 229, 0.05)';
                }

                return (
                  <button 
                    key={opt.id}
                    onClick={() => !isSubmitted && setSelectedOption(opt.id)}
                    disabled={isSubmitted}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: `2px solid ${borderColor}`,
                      backgroundColor: bgColor,
                      color: textColor,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: isSubmitted ? 'default' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: '24px' }}>
                      {isSubmitted && isCorrect && <CheckCircle2 size={20} color="var(--accent-green)" />}
                      {isSubmitted && isSelected && !isCorrect && <XCircle size={20} color="#EF4444" />}
                    </div>
                    {opt.text}
                  </button>
                )
              })}
            </div>

            {isSubmitted && (
              <div style={{ marginTop: '32px', padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <h4 className="font-bold mb-2">Explanation:</h4>
                <p className="text-secondary">{quiz.questions[currentQuestion].explanation}</p>
                <button 
                  onClick={handleNext}
                  style={{ marginTop: '24px', padding: '12px 24px', borderRadius: '12px', backgroundColor: 'var(--brand-primary)', color: 'white' }}
                >
                  {currentQuestion === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                </button>
              </div>
            )}

            {!isSubmitted && (
              <button 
                onClick={handleSubmit}
                disabled={!selectedOption}
                style={{ marginTop: '32px', padding: '12px 24px', borderRadius: '12px', backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', opacity: !selectedOption ? 0.5 : 1, width: '100%' }}
              >
                Submit Answer
              </button>
            )}
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
            <h3 className="text-3xl font-bold mb-4">Quiz Complete! 🎉</h3>
            <p className="text-xl mb-8">You scored {score} out of {quiz.questions.length}</p>
            <button 
              onClick={() => { resetQuizState(); setQuiz(null); localStorage.removeItem('workflow_quiz'); }}
              style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'var(--brand-primary)', color: 'white' }}
            >
              Take Another Quiz
            </button>
          </div>
        )
      ) : (
        !isGenerating && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Enter a topic to generate a quiz!</div>
      )}
    </div>
  );
};

export default Quizzes;
