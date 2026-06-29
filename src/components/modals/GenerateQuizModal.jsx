import React, { useState } from 'react';
import { X, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

const GenerateQuizModal = ({ isOpen, onClose, document, onGenerate }) => {
  const [pageRange, setPageRange] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !document) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    let ranges = [];
    if (pageRange) {
      const parts = pageRange.split(',').map(p => p.trim());
      for (let p of parts) {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map(Number);
          if (start && end) {
            for (let i = start; i <= end; i++) ranges.push(i);
          }
        } else {
          const num = Number(p);
          if (num) ranges.push(num);
        }
      }
    }
    
    // De-duplicate and sort
    ranges = [...new Set(ranges)].sort((a, b) => a - b);
    
    await onGenerate(ranges.length > 0 ? ranges : null);
    setIsGenerating(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'white', borderRadius: '16px', width: '500px', maxWidth: '90%', padding: '24px', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sparkles size={24} color="#8A334B" />
          Tạo Đề Từ Tài Liệu
        </h2>
        
        <div style={{ padding: '16px', backgroundColor: '#F8F9FA', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={24} color="#3B6B59" />
          <div>
            <div style={{ fontWeight: 600, color: '#1B2A4E' }}>{document.filename}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{document.page_count ? `${document.page_count} trang` : 'Không xác định số trang'}</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1B2A4E', marginBottom: '8px' }}>
            Trang muốn tạo đề (Để trống sẽ chọn toàn bộ)
          </label>
          <input 
            type="text" 
            placeholder="VD: 1, 3-5, 10" 
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
          />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Nhập số trang cụ thể để khoanh vùng kiến thức.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Hủy
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', backgroundColor: '#8A334B', color: 'white', border: 'none', cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isGenerating ? 0.7 : 1 }}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Tạo Đề Ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateQuizModal;
