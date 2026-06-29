import React, { useState } from 'react';
import { X, UploadCloud, BookOpen, RotateCcw, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const CreateStudyDocModal = ({ isOpen, onClose, projectId, documentId, onSuccess }) => {
  const activeDocId = documentId || (() => { const match = window.location.hash.match(/#\/document\/([^/]+)/); return match ? parseInt(match[1], 10) : null; })();
  const [title, setTitle] = useState("Tài liệu phòng thi 26/6/2026");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [length, setLength] = useState("Độ dài vừa phải (Tổng hợp lý thuyết & So sánh)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Result view state
  const [viewMode, setViewMode] = useState('form'); // 'form' | 'result'
  const [resultData, setResultData] = useState(null);

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
      
      const res = await fetch('http://127.0.0.1:8000/api/generate_exam_prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        setResultData(data);
        setViewMode('result');
        if (onSuccess) onSuccess();
      } else {
        alert("Tạo tài liệu phòng thi thất bại.");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = () => {
    setViewMode('form');
    setResultData(null);
  };

  const handleClose = () => {
    setViewMode('form');
    setResultData(null);
    onClose();
  };

  const handleDownloadMd = () => {
    if (!resultData) return;
    const content = `# ${resultData.title || title}\n\n${resultData.markdown_content || ''}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(resultData.title || title).replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF ]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Result View ───
  if (viewMode === 'result' && resultData) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', justifyContent: 'center', alignItems: 'center'
      }}>
        <div className="animate-fade-in" style={{
          backgroundColor: '#FCFAF8', borderRadius: '24px', width: '750px', maxWidth: '95vw',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
        }}>
          {/* Header */}
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: '#FCFAF8', borderRadius: '24px 24px 0 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color="#8A334C" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E', margin: 0 }}>{resultData.title || title}</h2>
            </div>
            <button onClick={handleClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Markdown Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div className="markdown-body" style={{ fontSize: '0.95rem', lineHeight: 1.7, color: '#1B2A4E' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {resultData.markdown_content || ''}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '20px 24px', backgroundColor: 'white', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center', gap: '12px', borderRadius: '0 0 24px 24px', flexShrink: 0 }}>
            <button onClick={handleRegenerate} style={{ padding: '12px 28px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '24px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={15} /> Tạo lại
            </button>
            <button onClick={handleDownloadMd} style={{ padding: '12px 28px', backgroundColor: 'white', border: '1px solid #8A334C', borderRadius: '24px', fontWeight: 600, color: '#8A334C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={15} /> Tải xuống .md
            </button>
            <button onClick={handleClose} style={{ padding: '12px 28px', backgroundColor: '#8A334C', border: 'none', borderRadius: '24px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form View ───
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>Cấu hình Tài liệu phòng thi</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>TIÊU ĐỀ TÀI LIỆU</label>
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
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>MỤC TIÊU ÔN TẬP / PHÒNG THI</label>
            <input 
              type="text" 
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Ví dụ: Ôn thi giữa kỳ, Tổng hợp công thức cốt lõi..." 
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>ĐỘ DÀI TÀI LIỆU</label>
            <select 
              value={length}
              onChange={(e) => setLength(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FDF8F5', fontSize: '0.9rem' }}
            >
              <option>Độ dài vừa phải (Tổng hợp lý thuyết & So sánh)</option>
              <option>Ngắn gọn (Chỉ gồm các bullet point chính)</option>
              <option>Rất chi tiết (Toàn bộ lý thuyết, ví dụ)</option>
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
            {isSubmitting ? "Đang tạo..." : "Tạo tài liệu"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateStudyDocModal;
