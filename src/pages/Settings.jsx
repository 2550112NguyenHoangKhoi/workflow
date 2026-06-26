import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, ShieldAlert, Cpu, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [engineMode, setEngineMode] = useState('algorithm'); // 'ai' or 'algorithm'

  useEffect(() => {
    const savedKey = localStorage.getItem('workflow_api_key');
    const savedMode = localStorage.getItem('workflow_engine_mode');
    
    if (savedKey) setApiKey(savedKey);
    if (savedMode) setEngineMode(savedMode);
  }, []);

  const handleSave = () => {
    localStorage.setItem('workflow_api_key', apiKey.trim());
    localStorage.setItem('workflow_engine_mode', engineMode);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ 
      maxWidth: '800px', margin: '0 auto', padding: '48px 24px',
      display: 'flex', flexDirection: 'column', gap: '32px'
    }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <SettingsIcon size={32} color="#8A334B" />
          Cài đặt hệ thống
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Cấu hình Workflow AI Study Assistant.
        </p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Cpu size={24} color="#3B6B59" />
          Chế độ hoạt động (Engine Mode)
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem' }}>
          Chọn cách thức tạo nội dung học tập. Bạn có thể sử dụng sức mạnh của AI (yêu cầu API Key) hoặc chạy dựa trên thuật toán tích hợp sẵn (Mock data) cho mục đích thử nghiệm.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div 
            onClick={() => setEngineMode('ai')}
            style={{ 
              border: `2px solid ${engineMode === 'ai' ? '#8A334B' : 'var(--border-light)'}`,
              backgroundColor: engineMode === 'ai' ? '#F8EFEA' : 'white',
              padding: '24px', borderRadius: '16px', cursor: 'pointer',
              transition: 'all 0.2s', textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '8px' }}>Google Gemini AI</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tạo câu hỏi & nội dung thông minh dựa trên tài liệu.</div>
          </div>
          
          <div 
            onClick={() => setEngineMode('algorithm')}
            style={{ 
              border: `2px solid ${engineMode === 'algorithm' ? '#3B6B59' : 'var(--border-light)'}`,
              backgroundColor: engineMode === 'algorithm' ? '#E8F5E9' : 'white',
              padding: '24px', borderRadius: '16px', cursor: 'pointer',
              transition: 'all 0.2s', textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '8px' }}>Local Algorithm</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Chạy giả lập offline không cần kết nối mạng.</div>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '0 -32px 32px' }}></div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Key size={24} color="#8A334B" />
          Google Gemini API Key
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem' }}>
          Vì đây là ứng dụng máy tính độc lập, bạn cần cung cấp API key cá nhân để sử dụng chế độ AI.
        </p>

        <div style={{ backgroundColor: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: '20px', borderRadius: '0 12px 12px 0', marginBottom: '24px' }}>
          <h3 style={{ fontWeight: 700, color: '#B45309', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
            <ShieldAlert size={18} /> Cách lấy API Key miễn phí:
          </h3>
          <ol style={{ paddingLeft: '24px', color: '#92400E', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
            <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#8A334B', textDecoration: 'underline', fontWeight: 600 }}>Google AI Studio</a>.</li>
            <li>Đăng nhập bằng tài khoản Google của bạn.</li>
            <li>Nhấn nút <strong>"Create API Key"</strong>.</li>
            <li>Copy đoạn mã (bắt đầu bằng <code style={{ backgroundColor: 'white', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FCD34D', color: '#1B2A4E', fontWeight: 'bold' }}>AIzaSy...</code>).</li>
            <li>Dán vào ô bên dưới và nhấn Lưu.</li>
          </ol>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1B2A4E' }}>Mã API Key của bạn</label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..........................."
              disabled={engineMode === 'algorithm'}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '16px',
                border: '2px solid var(--border-light)',
                backgroundColor: engineMode === 'algorithm' ? 'var(--bg-tertiary)' : 'white',
                color: '#1B2A4E',
                fontFamily: 'monospace',
                fontSize: '1rem',
                outline: 'none',
                opacity: engineMode === 'algorithm' ? 0.6 : 1
              }}
            />
            <button 
              onClick={handleSave}
              style={{
                padding: '0 32px',
                borderRadius: '16px',
                backgroundColor: isSaved ? '#3B6B59' : '#8A334B',
                color: 'white',
                fontWeight: 700,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: isSaved ? '0 4px 12px rgba(59, 107, 89, 0.3)' : '0 4px 12px rgba(138, 51, 75, 0.3)'
              }}
            >
              {isSaved ? <><CheckCircle2 size={20} /> Đã lưu</> : <><Save size={20} /> Lưu Cài Đặt</>}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Key của bạn được lưu trữ an toàn trên thiết bị và chỉ gửi trực tiếp tới máy chủ Google.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
