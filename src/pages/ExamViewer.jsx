import React, { useState } from 'react';
import { ArrowLeft, Download, X, Clock, Trophy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamViewer = () => {
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isInstantReveal, setIsInstantReveal] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});

  const questions = [
    {
      id: 49,
      type: 'TRẮC NGHIỆM',
      title: 'Trong chu kỳ tế bào, giai đoạn nào mô tả quá trình tái bản DNA?',
      options: [
        { id: 'A', text: 'G1', isCorrect: false },
        { id: 'B', text: 'S', isCorrect: true },
        { id: 'C', text: 'G2', isCorrect: false },
        { id: 'D', text: 'M', isCorrect: false }
      ],
      explanation: 'Quá trình nhân đôi DNA diễn ra theo kiểu bán bảo tồn, nghĩa là mỗi phân tử DNA con sẽ có một mạch gốc từ phân tử DNA mẹ và một mạch mới được tổng hợp. Điều này đã được chứng minh bởi thí nghiệm của Meselson và Stahl năm 1958 (D3D p.9).'
    },
    {
      id: 50,
      type: 'ĐIỀN KHUYẾT',
      title: 'Nêu vai trò của enzyme DNA glycosylase trong quá trình sửa chữa DNA.',
      options: null,
      explanation: 'DNA glycosylase có vai trò nhận diện và cắt bỏ các base bị hỏng, tạo ra một vị trí AP (apurinic/apyrimidinic) để các enzyme khác tiếp tục quá trình sửa chữa.'
    }
  ];

  const handleSelect = (qId, val) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const getOptionStyle = (qId, oId, isCorrect) => {
    const isSelected = selectedAnswers[qId] === oId;
    const showReveal = isSubmitted || (isInstantReveal && isSelected);
    
    if (!showReveal) {
      if (isSelected) return { backgroundColor: '#F3EAE3', border: '1px solid #8A334B', color: '#1B2A4E' };
      return { backgroundColor: 'white', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' };
    }

    if (isCorrect) return { backgroundColor: '#E8F5E9', border: '1px solid #4CAF50', color: '#1B2A4E' };
    if (isSelected && !isCorrect) return { backgroundColor: '#FDF2F2', border: '1px solid #FCA5A5', color: '#991B1B' };
    return { backgroundColor: 'white', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F8EFEA' }}>
      
      {/* Top Header */}
      <div style={{ height: '72px', backgroundColor: '#E2F0D9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate(-1)} style={{ backgroundColor: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
            <ArrowLeft size={20} color="#8A334B" />
          </button>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E', margin: 0, letterSpacing: '0.02em' }}>Đề thi ôn tập 19/6/2026 SHPT</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Đề thi học thuật</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#3B6B59', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            <Download size={16} /> Tải PDF
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            <FileText size={16} /> Tải JSON
          </button>
          <button onClick={() => navigate(-1)} style={{ backgroundColor: '#F3EAE3', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8A334B' }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content 3 Columns */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 300px minmax(300px, 1fr)', overflow: 'hidden' }}>
        
        {/* Left Column: Quiz */}
        <div style={{ overflowY: 'auto', padding: '32px 48px' }}>
          {questions.map((q) => {
            const hasAnswered = selectedAnswers[q.id] !== undefined;
            const isCorrect = q.type === 'TRẮC NGHIỆM' && q.options.find(o => o.id === selectedAnswers[q.id])?.isCorrect;
            const isWrong = q.type === 'TRẮC NGHIỆM' && hasAnswered && !isCorrect;
            const showReveal = isSubmitted || (isInstantReveal && hasAnswered);

            return (
              <div key={q.id} style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#F8EFEA', color: '#8A334B', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>
                    CÂU {q.id} - {q.type}
                  </div>
                  {showReveal && isWrong && <div style={{ color: '#991B1B', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><X size={16} /> Sai</div>}
                  {showReveal && isCorrect && <div style={{ color: '#3B6B59', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={16} /> Đúng</div>}
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B2A4E', marginBottom: '24px', lineHeight: '1.5' }}>
                  {q.title}
                </h3>

                {q.type === 'TRẮC NGHIỆM' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {q.options.map(o => (
                      <button 
                        key={o.id}
                        onClick={() => handleSelect(q.id, o.id)}
                        style={{ 
                          ...getOptionStyle(q.id, o.id, o.isCorrect),
                          padding: '16px 24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', 
                          cursor: (isSubmitted || (isInstantReveal && hasAnswered)) ? 'default' : 'pointer', textAlign: 'left', fontWeight: 500, fontSize: '0.95rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ 
                          width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: selectedAnswers[q.id] === o.id ? (showReveal ? (o.isCorrect ? '#3B6B59' : '#991B1B') : '#8A334B') : '#EBE0D8',
                          color: selectedAnswers[q.id] === o.id ? 'white' : 'var(--text-secondary)',
                          fontWeight: 700, fontSize: '0.85rem'
                        }}>
                          {o.id}
                        </div>
                        {o.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea 
                    placeholder="Nhập câu trả lời của bạn..."
                    value={selectedAnswers[q.id] || ''}
                    onChange={(e) => handleSelect(q.id, e.target.value)}
                    disabled={isSubmitted || (isInstantReveal && hasAnswered && selectedAnswers[q.id].length > 10)}
                    style={{
                      width: '100%', minHeight: '120px', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-medium)',
                      fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', backgroundColor: '#FAFAFA'
                    }}
                  />
                )}

                {showReveal && (
                  <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px solid var(--brand-primary)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Giải thích chi tiết:</div>
                    <div style={{ fontSize: '0.95rem', color: '#1B2A4E', lineHeight: '1.6' }}>
                      {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Middle Column: Control Panel */}
        <div style={{ backgroundColor: 'white', borderLeft: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '24px' }}>BẢNG ĐIỀU KHIỂN</h3>
          
          <div style={{ border: '1px solid var(--border-light)', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
            <Clock size={24} color="#8A334B" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Thời gian làm bài</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1B2A4E' }}>45 phút</div>
          </div>

          {!isSubmitted ? (
            <>
              <div style={{ backgroundColor: '#F8EFEA', borderRadius: '16px', padding: '24px', marginBottom: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', textAlign: 'center' }}>
                Làm thử đề thi được AI tạo trực tiếp dựa trên tài liệu bạn đã chọn. Bấm <strong>Nộp bài</strong> để xem điểm và giải thích chi tiết.
              </div>
              <button onClick={() => setIsSubmitted(true)} style={{ backgroundColor: '#3B6B59', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginBottom: '16px', boxShadow: '0 4px 12px rgba(59, 107, 89, 0.3)' }}>
                Nộp bài thi
              </button>
            </>
          ) : (
            <>
              <div style={{ backgroundColor: '#E8F5E9', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', marginBottom: '24px' }}>
                <Trophy size={32} color="#3B6B59" style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: '0.85rem', color: '#3B6B59', fontWeight: 700, marginBottom: '8px' }}>Kết quả làm bài</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1B2A4E', marginBottom: '4px' }}>48 / 50</div>
                <div style={{ fontSize: '0.9rem', color: '#3B6B59', fontWeight: 700 }}>Đúng 96%</div>
              </div>
              <button onClick={() => { setIsSubmitted(false); setSelectedAnswers({}); }} style={{ backgroundColor: '#8A334B', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginBottom: '16px', boxShadow: '0 4px 12px rgba(138, 51, 75, 0.3)' }}>
                Làm lại bài thi
              </button>
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '2px solid var(--border-light)', borderRadius: '16px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isInstantReveal}
              onChange={(e) => setIsInstantReveal(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#8A334B' }} 
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1B2A4E' }}>Hiện đáp án & Giải thích luôn</span>
          </label>
        </div>

        {/* Right Column: Source Document */}
        <div style={{ backgroundColor: 'white', padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>NGUỒN: TÀI LIỆU ĐỐI CHIẾU</h3>
            <X size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
          </div>

          <div style={{ border: '2px solid var(--brand-primary)', borderRadius: '16px', padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1B2A4E', marginBottom: '4px' }}>Tài liệu đối chiếu</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trang 9 / 35</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <button style={{ flex: 1, backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Zoom -</button>
              <button style={{ flex: 1, backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Zoom +</button>
              <button style={{ flex: 1, backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Trang trước</button>
              <button style={{ flex: 1, backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Trang sau</button>
              <button style={{ flex: 1, backgroundColor: '#F8EFEA', border: 'none', borderRadius: '8px', padding: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#8A334B' }}>Mở tab mới</button>
            </div>

            {/* Fake PDF Render */}
            <div style={{ flex: 1, backgroundColor: 'white', border: '1px solid var(--border-light)', padding: '24px', overflowY: 'auto', color: '#1B2A4E', fontSize: '1rem', lineHeight: '1.8' }}>
              <h2 style={{ color: '#1B2A4E', fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Semi-conservative replication</h2>
              <p style={{ marginBottom: '16px' }}>
                Quá trình nhân đôi DNA diễn ra theo kiểu bán bảo tồn, nghĩa là mỗi phân tử DNA con sẽ có một mạch gốc từ phân tử DNA mẹ và một mạch mới được tổng hợp. Điều này đã được chứng minh bởi thí nghiệm của Meselson và Stahl năm 1958.
              </p>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Đang hiển thị trang 9
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExamViewer;
