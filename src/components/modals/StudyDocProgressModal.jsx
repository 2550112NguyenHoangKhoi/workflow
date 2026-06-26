import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

const StudyDocProgressModal = ({ isOpen, onClose }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            return 100;
          }
          return p + 1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getStepStatus = (stepProgress) => {
    if (progress >= stepProgress) {
      return (
        <div style={{ backgroundColor: '#E8F5E9', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4CAF50' }}>
          <Check size={12} />
        </div>
      );
    }
    return (
      <div style={{ backgroundColor: '#EBE0D8', width: '8px', height: '8px', borderRadius: '50%', margin: '6px' }} />
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '500px', maxWidth: '90vw',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>Đang tiến hành tạo tài liệu học tập...</h2>
          <button onClick={onClose} style={{ background: '#F3EAE3', border: 'none', cursor: 'pointer', color: '#8A334B', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 32px 32px' }}>
          
          {/* Progress Bar */}
          <div style={{ marginBottom: '8px', height: '8px', backgroundColor: '#EBE0D8', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#3B6B59', borderRadius: '4px', transition: 'width 0.1s linear' }} />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '32px' }}>
            <span>Đang trích xuất nội dung</span>
            <span>{progress}%</span>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: progress >= 0 ? 700 : 500, color: progress >= 0 ? '#1B2A4E' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Đang chuẩn bị tài liệu</span>
              {getStepStatus(0)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: progress >= 20 ? 700 : 500, color: progress >= 20 ? '#1B2A4E' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Đang trích xuất nội dung</span>
              {getStepStatus(20)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: progress >= 40 ? 700 : 500, color: progress >= 40 ? '#1B2A4E' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Đang chọn nội dung quan trọng</span>
              {getStepStatus(40)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: progress >= 60 ? 700 : 500, color: progress >= 60 ? '#1B2A4E' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Đang tạo đề/tài liệu</span>
              {getStepStatus(60)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: progress >= 80 ? 700 : 500, color: progress >= 80 ? '#1B2A4E' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Đang lưu kết quả</span>
              {getStepStatus(80)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: progress >= 100 ? 700 : 500, color: progress >= 100 ? '#1B2A4E' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Hoàn tất</span>
              {getStepStatus(100)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudyDocProgressModal;
