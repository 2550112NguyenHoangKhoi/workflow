import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, BrainCircuit } from 'lucide-react';

const TakeQuizModal = ({ isOpen, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [answers, setAnswers] = useState({});
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetch('http://127.0.0.1:8000/api/documents')
        .then(res => res.json())
        .then(data => {
          setDocuments(data.documents);
          if (data.documents.length > 0) {
            setActiveDoc(data.documents[data.documents.length - 1]);
          }
        });
    } else {
      // Reset state when closed
      setQuizData(null);
      setAnswers({});
      setIsSubmitted(false);
      setScore(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerateQuiz = async () => {
    if (!activeDoc) return alert("Please upload a document first!");
    setIsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/generate_quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_or_text: activeDoc.content })
      });
      const data = await res.json();
      setQuizData(data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz.");
    }
    setIsLoading(false);
  };

  const handleSelectAnswer = (questionIndex, optionId) => {
    if (isSubmitted) return;
    setAnswers({ ...answers, [questionIndex]: optionId });
  };

  const handleSubmitQuiz = async () => {
    if (!quizData) return;
    let correctCount = 0;
    quizData.questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_option_id) {
        correctCount++;
      }
    });
    setScore(correctCount);
    setIsSubmitted(true);

    // Save to DB
    try {
      await fetch('http://127.0.0.1:8000/api/quizzes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: activeDoc.id,
          score: correctCount,
          total_questions: quizData.questions.length
        })
      });
    } catch (err) {
      console.error("Failed to save score", err);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '800px', maxWidth: '90vw',
        height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', letterSpacing: '0.05em', marginBottom: '4px' }}>OFFLINE NLP ENGINE</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>
              {quizData ? quizData.title : "Automated Knowledge Quiz"}
            </h2>
            {activeDoc && !quizData && (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Source: {activeDoc.filename}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {!activeDoc ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
              Chưa có tài liệu. Hãy Upload tài liệu trước.
            </div>
          ) : !quizData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '24px' }}>
              <BrainCircuit size={64} color="var(--brand-primary)" opacity={0.5} />
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                Nhấn nút bên dưới để trích xuất câu hỏi trắc nghiệm tự động từ tài liệu <b>{activeDoc.filename}</b>.
              </div>
              <button 
                onClick={handleGenerateQuiz} 
                disabled={isLoading}
                style={{ padding: '16px 32px', backgroundColor: 'var(--brand-primary)', color: 'white', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? "Đang xử lý offline..." : "Tạo Quiz Tự Động"}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {isSubmitted && (
                <div style={{ backgroundColor: score === quizData.questions.length ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${score === quizData.questions.length ? '#10B981' : '#EF4444'}`, padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: score === quizData.questions.length ? '#047857' : '#B91C1C', marginBottom: '8px' }}>
                    Kết quả: {score} / {quizData.questions.length}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Điểm của bạn đã được lưu vào cơ sở dữ liệu SQLite cục bộ.</p>
                </div>
              )}

              {quizData.questions.map((q, qIdx) => (
                <div key={qIdx} style={{ backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B2A4E', marginBottom: '16px', lineHeight: 1.5 }}>
                    Câu {qIdx + 1}: {q.question}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {q.options.map(opt => {
                      const isSelected = answers[qIdx] === opt.id;
                      const isCorrect = opt.id === q.correct_option_id;
                      
                      let bgColor = 'white';
                      let borderColor = 'var(--border-medium)';
                      let textColor = 'var(--text-primary)';
                      
                      if (isSubmitted) {
                        if (isCorrect) {
                          bgColor = '#ECFDF5';
                          borderColor = '#10B981';
                          textColor = '#047857';
                        } else if (isSelected && !isCorrect) {
                          bgColor = '#FEF2F2';
                          borderColor = '#EF4444';
                          textColor = '#B91C1C';
                        }
                      } else if (isSelected) {
                        bgColor = '#F0F9FF';
                        borderColor = '#3B82F6';
                        textColor = '#1D4ED8';
                      }

                      return (
                        <div 
                          key={opt.id}
                          onClick={() => handleSelectAnswer(qIdx, opt.id)}
                          style={{
                            padding: '16px', borderRadius: '12px', border: `2px solid ${borderColor}`,
                            backgroundColor: bgColor, color: textColor, cursor: isSubmitted ? 'default' : 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{opt.id}. {opt.text}</span>
                          {isSubmitted && isCorrect && <CheckCircle size={20} color="#10B981" />}
                          {isSubmitted && isSelected && !isCorrect && <XCircle size={20} color="#EF4444" />}
                        </div>
                      );
                    })}
                  </div>
                  {isSubmitted && (
                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', borderLeft: '4px solid #3B82F6', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <b>Giải thích:</b> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {quizData && !isSubmitted && (
          <div style={{ padding: '24px', backgroundColor: 'white', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', flexShrink: 0 }}>
            <button 
              onClick={handleSubmitQuiz}
              disabled={Object.keys(answers).length < quizData.questions.length}
              style={{ padding: '16px 32px', backgroundColor: 'var(--brand-primary)', border: 'none', borderRadius: '12px', fontWeight: 700, color: 'white', cursor: Object.keys(answers).length < quizData.questions.length ? 'not-allowed' : 'pointer', opacity: Object.keys(answers).length < quizData.questions.length ? 0.5 : 1 }}
            >
              Nộp Bài
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TakeQuizModal;
