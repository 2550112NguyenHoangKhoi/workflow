import React, { useState } from 'react';
import { X, Check, Zap, Crown } from 'lucide-react';

const PricingModal = ({ isOpen, onClose }) => {
  const [isUpgraded, setIsUpgraded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const userStr = localStorage.getItem('workflow_user');
      const email = userStr ? JSON.parse(userStr).email : 'guest@local.app';
      const response = await fetch('http://127.0.0.1:8000/api/user/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (response.ok) {
        if (userStr) {
          const userObj = JSON.parse(userStr);
          userObj.status = 'premium';
          localStorage.setItem('workflow_user', JSON.stringify(userObj));
        }
        setIsUpgraded(true);
      } else {
        alert("Có lỗi xảy ra khi nâng cấp gói.");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      setIsUpgraded(true);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (isUpgraded) {
    return (
      <div className="modal-overlay animate-fade-in" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
      }} onClick={onClose}>
        <div className="modal-content animate-slide-up" style={{
          backgroundColor: 'var(--bg-primary)', borderRadius: '24px', padding: '40px',
          width: '100%', maxWidth: '500px', textAlign: 'center',
          boxShadow: 'var(--shadow-premium)', position: 'relative'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ color: 'var(--success)', fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: '16px' }}>Nâng cấp thành công!</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Chào mừng bạn đến với Workflow Pro. Tất cả các tính năng nâng cao đã được mở khóa.
          </p>
          <button style={{
            padding: '12px 24px', borderRadius: '12px', border: 'none',
            backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 700,
            cursor: 'pointer'
          }} onClick={onClose}>
            Bắt đầu học ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay animate-fade-in" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div className="modal-content animate-slide-up" style={{
        backgroundColor: 'var(--bg-primary)', borderRadius: '24px', padding: '40px',
        width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-premium)', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '24px', right: '24px', background: 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
        }}>
          <X size={24} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-navy)', margin: '0 0 12px 0' }}>
            Nâng cấp Workflow Pro
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Mở khóa toàn bộ sức mạnh của AI để học tập hiệu quả hơn.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Free Tier */}
          <div style={{ border: '2px solid var(--border-light)', borderRadius: '20px', padding: '32px', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '8px' }}>Gói Cơ bản</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '24px' }}>Miễn phí</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}><Check size={20} color="var(--success)" /> 1 Dự án (Workspace)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}><Check size={20} color="var(--success)" /> Sử dụng API Key cá nhân</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}><Check size={20} color="var(--success)" /> Chạy model Local (Ollama)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}><Check size={20} color="var(--success)" /> Tính năng Chat cơ bản</div>
            </div>

            <button style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-medium)', backgroundColor: 'transparent', color: 'var(--text-navy)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
              Đang sử dụng
            </button>
          </div>

          {/* Pro Tier */}
          <div style={{ border: '2px solid var(--brand-primary)', borderRadius: '20px', padding: '32px', backgroundColor: 'var(--bg-tertiary)', position: 'relative', boxShadow: '0 8px 32px rgba(138, 51, 75, 0.15)' }}>
            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--brand-primary)', color: 'white', padding: '4px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <Crown size={14} /> KHUYÊN DÙNG
            </div>
            
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: '8px' }}>Workflow Pro</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '24px' }}>99.000đ<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>/tháng</span></div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-navy)', fontWeight: 500 }}><Zap size={20} color="var(--brand-primary)" /> Không giới hạn Dự án</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-navy)', fontWeight: 500 }}><Zap size={20} color="var(--brand-primary)" /> Sử dụng AI không cần API Key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-navy)', fontWeight: 500 }}><Zap size={20} color="var(--brand-primary)" /> Tạo Giáo án thông minh (AI)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-navy)', fontWeight: 500 }}><Zap size={20} color="var(--brand-primary)" /> Truy cập sớm tính năng mới</div>
            </div>

            <button 
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(138, 51, 75, 0.2)' }} 
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? "Đang xử lý..." : "Nâng cấp ngay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
