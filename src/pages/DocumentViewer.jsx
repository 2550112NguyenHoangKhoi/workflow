import React from 'react';
import { Users, Upload, ArrowRight } from 'lucide-react';

const DocumentViewer = () => {

  const actionPills = [
    "Tạo quiz nhanh",
    "Tạo flashcard",
    "Giải thích lại",
    "Cho ví dụ"
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8EFEA', padding: '0' }}>
      
      {/* Header */}
      <div style={{ padding: '32px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <span style={{ fontSize: '1rem' }}>✧</span> OMIGUIDE
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#1B2A4E', marginBottom: '4px' }}>
            CK_HK233 (1)
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>1 source attached</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
            <Users size={16} color="var(--text-secondary)" /> 1 members
          </div>
          <div style={{ display: 'flex', backgroundColor: '#EBE0D8', borderRadius: '24px', padding: '4px' }}>
            <button style={{ backgroundColor: 'transparent', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer' }}>
              Chat chính
            </button>
            <button style={{ backgroundColor: 'var(--brand-primary)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, color: 'white', fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              OmiGuide
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
          Đang suy nghĩ <span style={{ letterSpacing: '2px', color: 'var(--brand-primary)' }}>•••</span>
        </div>
      </div>

      {/* Input Area */}
      <div style={{ padding: '0 48px 32px' }}>
        {/* Action Pills */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
          {actionPills.map(pill => (
            <button key={pill} style={{
              backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', padding: '8px 16px',
              fontSize: '0.85rem', fontWeight: 600, color: '#1B2A4E', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              {pill}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', padding: '8px 8px 8px 16px', boxShadow: 'var(--shadow-md)' }}>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px' }}>
            <Upload size={20} />
          </button>
          <input 
            type="text" 
            placeholder="Hỏi OmiGuide hoặc yêu cầu quiz/flashcard..." 
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', padding: '8px 12px', color: 'var(--text-primary)' }} 
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>1 source</span>
            <button style={{ backgroundColor: 'var(--brand-primary)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DocumentViewer;
