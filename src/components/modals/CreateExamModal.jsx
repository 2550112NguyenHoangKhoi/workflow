import React, { useState } from 'react';
import { X, UploadCloud, Sparkles } from 'lucide-react';

const CreateExamModal = ({ isOpen, onClose, projectId, documentId, onSuccess }) => {
  const activeDocId = documentId || (() => { const match = window.location.hash.match(/#\/document\/([^/]+)/); return match ? parseInt(match[1], 10) : null; })();
  const [title, setTitle] = useState("Đề thi ôn tập 26/6/2026");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("45 phút");
  const [questionCount, setQuestionCount] = useState("10 câu");
  const [difficulty, setDifficulty] = useState("Trung bình");
  const [language, setLanguage] = useState("Tiếng Việt");
  const [questionTypes, setQuestionTypes] = useState({
    mcq: true,
    shortAnswer: false,
    trueFalse: false,
    essay: false
  });
  const [withExplanation, setWithExplanation] = useState(true);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const payload = {
        topic_or_text: text || `Đề thi ôn tập: ${title}. Mô tả: ${description}. Thời gian: ${time}. Độ khó: ${difficulty}.`,
        api_key: localStorage.getItem('workflow_gemini_key') || localStorage.getItem('workflow_api_key') || '',
        project_id: projectId ? parseInt(projectId) : null,
        document_id: activeDocId ? parseInt(activeDocId) : null,
        page_ranges: [1],
      };
      
      const res = await fetch('http://127.0.0.1:8000/api/generate_quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert("Đã tạo đề thi thành công!");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        alert("Tạo đề thi thất bại.");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '650px', maxWidth: '90vw',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, backgroundColor: '#FCFAF8', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--brand-secondary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>Cấu hình Tạo đề thi</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>TIÊU ĐỀ ĐỀ THI</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem', fontWeight: 600 }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>MÔ TẢ</label>
            <textarea 
              rows={3} 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem', resize: 'none' }}
            ></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>THỜI GIAN LÀM BÀI</label>
              <select 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }}
              >
                <option>15 phút</option>
                <option>30 phút</option>
                <option>45 phút</option>
                <option>60 phút</option>
                <option>90 phút</option>
                <option>120 phút</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>SỐ LƯỢNG CÂU HỎI</label>
              <select 
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }}
              >
                <option>5 câu</option>
                <option>10 câu</option>
                <option>20 câu</option>
                <option>30 câu</option>
                <option>40 câu</option>
                <option>50 câu</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>ĐỘ KHÓ</label>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }}
              >
                <option>Dễ</option>
                <option>Trung bình</option>
                <option>Khó</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>NGÔN NGỮ</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }}
              >
                <option>Tiếng Việt</option>
                <option>English</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>DẠNG CÂU HỎI</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '1px solid var(--border-medium)', borderRadius: '12px', cursor: 'pointer', backgroundColor: 'white' }}>
                <input 
                  type="checkbox" 
                  checked={questionTypes.mcq} 
                  onChange={(e) => setQuestionTypes({ ...questionTypes, mcq: e.target.checked })}
                  style={{ accentColor: '#3B82F6', width: '16px', height: '16px' }} 
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Trắc nghiệm (4 lựa chọn)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '1px solid var(--border-medium)', borderRadius: '12px', cursor: 'pointer', backgroundColor: 'white' }}>
                <input 
                  type="checkbox" 
                  checked={questionTypes.shortAnswer}
                  onChange={(e) => setQuestionTypes({ ...questionTypes, shortAnswer: e.target.checked })}
                  style={{ accentColor: '#3B82F6', width: '16px', height: '16px' }} 
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Trả lời ngắn</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '1px solid var(--border-medium)', borderRadius: '12px', cursor: 'pointer', backgroundColor: 'white' }}>
                <input 
                  type="checkbox" 
                  checked={questionTypes.trueFalse}
                  onChange={(e) => setQuestionTypes({ ...questionTypes, trueFalse: e.target.checked })}
                  style={{ accentColor: '#3B82F6', width: '16px', height: '16px' }} 
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Đúng / Sai</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '1px solid var(--border-medium)', borderRadius: '12px', cursor: 'pointer', backgroundColor: 'white' }}>
                <input 
                  type="checkbox" 
                  checked={questionTypes.essay}
                  onChange={(e) => setQuestionTypes({ ...questionTypes, essay: e.target.checked })}
                  style={{ accentColor: '#3B82F6', width: '16px', height: '16px' }} 
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Tự luận / Trả lời tự do</span>
              </label>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '1px solid var(--border-medium)', borderRadius: '12px', cursor: 'pointer', backgroundColor: 'white' }}>
            <input 
              type="checkbox" 
              checked={withExplanation} 
              onChange={(e) => setWithExplanation(e.target.checked)}
              style={{ accentColor: '#3B82F6', width: '16px', height: '16px' }} 
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Tạo đáp án kèm giải thích chi tiết</span>
          </label>

          {/* Data Source Block */}
          <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '16px', backgroundColor: '#FDF8F5', marginTop: '8px' }}>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '16px' }}>TÀI LIỆU LÀM NGUỒN DỮ LIỆU</div>
            
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-light)', padding: '16px', marginBottom: '16px' }}>
                         <textarea 
                placeholder="Dán đoạn văn, bài học, ghi chú hoặc nội dung cần tạo đề thi..." 
                rows={5} 
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#FDF8F5', fontSize: '0.9rem', resize: 'none' }}
              ></textarea>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Dùng được độc lập, không cần upload file.</span>
                <span>{(text.length / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button style={{ backgroundColor: '#F3EAE3', color: 'var(--brand-primary)', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <UploadCloud size={16} /> Tải lên file từ máy
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hỗ trợ PDF, DOCX, TXT, PNG/JPG/WebP/TIFF. Tổng nguồn tối đa 20 MB.</span>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Tổng dung lượng nguồn: {(text.length / 1024).toFixed(1)} KB / 20 MB
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', backgroundColor: 'white', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center', gap: '12px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          <button onClick={onClose} style={{ padding: '12px 32px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '24px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Hủy bộ
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ 
              padding: '12px 32px', 
              backgroundColor: isSubmitting ? '#9CA3AF' : '#1B2A4E', 
              border: 'none', 
              borderRadius: '24px', 
              fontWeight: 600, 
              color: 'white', 
              cursor: isSubmitting ? 'not-allowed' : 'pointer' 
            }}
          >
            {isSubmitting ? "Đang tạo..." : "Tạo đề thi"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateExamModal;
