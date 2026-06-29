import React, { useState } from 'react';
import { X, UploadCloud, BookOpen } from 'lucide-react';

const CreateLessonPlanModal = ({ isOpen, onClose, projectId, documentId, onSuccess }) => {
  const activeDocId = documentId || (() => { const match = window.location.hash.match(/#\/document\/([^/]+)/); return match ? parseInt(match[1], 10) : null; })();
  const [title, setTitle] = useState("Giáo án 1 tiết - Tiêu hóa ở dạ dày");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [length, setLength] = useState("Chuẩn giáo án 45 phút");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const payload = {
        topic_or_text: target || `Tiêu đề: ${title}. Mô tả: ${description}. Độ dài: ${length}.`,
        api_key: localStorage.getItem('workflow_gemini_key') || localStorage.getItem('workflow_api_key') || '',
        project_id: projectId ? parseInt(projectId) : null,
        document_id: activeDocId ? parseInt(activeDocId) : null,
      };
      
      const res = await fetch('http://127.0.0.1:8000/api/generate_study_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert("Tạo Giáo án thành công!");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        alert("Tạo Giáo án thất bại.");
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
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '600px', maxWidth: '90vw',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, backgroundColor: '#FCFAF8', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="#8B4B6E" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>Cấu hình Giáo án giảng dạy</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>TIÊU ĐỀ GIÁO ÁN</label>
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

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>ĐỐI TƯỢNG HỌC SINH</label>
            <input 
              type="text" 
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Ví dụ: Học sinh lớp 8, người đi làm mất gốc..." 
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>THỜI LƯỢNG TIẾT HỌC</label>
            <select 
              value={length}
              onChange={(e) => setLength(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }}
            >
              <option>Chuẩn giáo án 45 phút</option>
              <option>Giáo án 90 phút</option>
              <option>Kịch bản workshop 2 tiếng</option>
            </select>
          </div>

          {/* Data Source Block */}
          <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '16px', backgroundColor: '#FDF8F5', marginTop: '8px' }}>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '16px' }}>TÀI LIỆU LÀM NGUỒN DỮ LIỆU</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button style={{ backgroundColor: '#F3EAE3', color: 'var(--brand-primary)', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <UploadCloud size={16} /> Tải lên file từ máy
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hỗ trợ PDF, DOCX, TXT, PNG/JPG/WebP/TIFF. Tổng nguồn tối đa 20 MB.</span>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Tổng dung lượng nguồn: 0 KB / 20 MB
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', backgroundColor: 'white', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center', gap: '12px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          <button onClick={onClose} style={{ padding: '12px 32px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '24px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Hủy bỏ
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ 
              padding: '12px 32px', 
              backgroundColor: isSubmitting ? '#9CA3AF' : '#8B4B6E', 
              border: 'none', 
              borderRadius: '24px', 
              fontWeight: 600, 
              color: 'white', 
              cursor: isSubmitting ? 'not-allowed' : 'pointer' 
            }}
          >
            {isSubmitting ? "Đang tạo..." : "Tạo Giáo án"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateLessonPlanModal;
