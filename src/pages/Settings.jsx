import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, ShieldAlert, Cpu, Server, Settings as SettingsIcon, Download, TerminalSquare, RefreshCw, XCircle, Sparkles } from 'lucide-react';

// Three interchangeable engines power EVERY AI feature (chat, quiz, flashcards, notes, concept
// map, roadmap...). The choice is encoded into localStorage['workflow_api_key'], which every
// modal/page already sends to the backend:
//   'ai'        -> the user's Gemini key (cloud)      -> backend uses Gemini
//   'local'     -> sentinel 'LOCAL'                   -> backend routes to a local Ollama model
//   'algorithm' -> sentinel 'OFFLINE'                 -> backend uses the deterministic NLP engine
const ENGINES = [
  { id: 'ai', title: 'Cloud API (Gemini)', color: '#8A334B', bg: '#F8EFEA', desc: 'Chất lượng cao nhất. Cần API key Google Gemini (miễn phí).' },
  { id: 'local', title: 'Model cục bộ (Ollama)', color: '#2563EB', bg: '#EFF6FF', desc: 'Tải model AI về máy, chạy offline bằng CPU/GPU của bạn.' },
  { id: 'algorithm', title: 'Thuật toán (NLP)', color: '#3B6B59', bg: '#E8F5E9', desc: 'Bộ máy NLP tích hợp (TextRank, pyvi). Không cần cài đặt gì.' },
];

const Settings = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [engineMode, setEngineMode] = useState('ai'); // 'ai' | 'local' | 'algorithm'
  const [localStatus, setLocalStatus] = useState(null);
  const [checkingLocal, setCheckingLocal] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('workflow_gemini_key');
    const savedMode = localStorage.getItem('workflow_engine_mode');
    if (savedKey) setApiKey(savedKey);
    if (savedMode) setEngineMode(savedMode);
  }, []);

  const handleSave = () => {
    const key = apiKey.trim();
    localStorage.setItem('workflow_gemini_key', key);
    localStorage.setItem('workflow_engine_mode', engineMode);
    // Encode the engine choice into the signal every API call already sends.
    const signal = engineMode === 'algorithm' ? 'OFFLINE' : engineMode === 'local' ? 'LOCAL' : key;
    localStorage.setItem('workflow_api_key', signal);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const checkLocal = async () => {
    setCheckingLocal(true);
    setLocalStatus(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/engine/local_status');
      setLocalStatus(await res.json());
    } catch {
      setLocalStatus({ available: false, error: 'Không kết nối được backend (cổng 8000).' });
    }
    setCheckingLocal(false);
  };

  const codeBox = (text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0F172A', color: '#E2E8F0', padding: '12px 16px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '0.9rem', margin: '8px 0' }}>
      <TerminalSquare size={16} color="#64748B" /> {text}
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <SettingsIcon size={32} color="#8A334B" />
          Cài đặt hệ thống
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Cấu hình bộ máy AI cho mọi tính năng học tập của hệ thống.</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} />
            Mô hình AI Mặc định
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Áp dụng cho toàn bộ tính năng: AI Assistant, tạo quiz, flashcard, smart notes, concept map, lộ trình học. Có thể đổi bất cứ lúc nào.
          </p>
        </div>

        {/* Engine选择 — 3 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          {ENGINES.map((e) => (
            <div key={e.id} onClick={() => setEngineMode(e.id)} style={{
              border: `2px solid ${engineMode === e.id ? e.color : 'var(--border-light)'}`,
              backgroundColor: engineMode === e.id ? e.bg : 'white',
              padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s'
            }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '6px' }}>{e.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '0 -32px 28px' }}></div>

        {/* === Cloud API (Gemini) === */}
        {engineMode === 'ai' && (
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Key size={22} color="#8A334B" /> Google Gemini API Key
            </h2>
            <div style={{ backgroundColor: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: '20px', borderRadius: '0 12px 12px 0', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: 700, color: '#B45309', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                <ShieldAlert size={18} /> Cách lấy API Key miễn phí:
              </h3>
              <ol style={{ paddingLeft: '24px', color: '#92400E', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#8A334B', textDecoration: 'underline', fontWeight: 600 }}>Google AI Studio → API Keys</a>.</li>
                <li>Đăng nhập bằng tài khoản Google của bạn.</li>
                <li>Nhấn <strong>"Create API Key"</strong> → chọn project (hoặc tạo mới).</li>
                <li>Copy mã bắt đầu bằng <code style={{ backgroundColor: 'white', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FCD34D', color: '#1B2A4E', fontWeight: 'bold' }}>AIzaSy...</code></li>
                <li>Dán vào ô bên dưới và nhấn <strong>Lưu</strong>.</li>
              </ol>
            </div>
            <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1B2A4E' }}>Mã API Key của bạn</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..........................."
              style={{ width: '100%', marginTop: '8px', padding: '16px', borderRadius: '16px', border: '2px solid var(--border-light)', color: '#1B2A4E', fontFamily: 'monospace', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Key lưu trên thiết bị của bạn và chỉ gửi tới máy chủ Google.</p>
          </div>
        )}

        {/* === Local model (Ollama) === */}
        {engineMode === 'local' && (
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={22} color="#2563EB" /> Tải & chạy model AI cục bộ
            </h2>
            <div style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #2563EB', padding: '20px', borderRadius: '0 12px 12px 0', marginBottom: '20px' }}>
              <ol style={{ paddingLeft: '24px', color: '#1E40AF', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                <li>Cài <a href="https://ollama.com/download" target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', textDecoration: 'underline', fontWeight: 600 }}>Ollama</a> (macOS / Windows / Linux).</li>
                <li>Mở Terminal và tải một model về máy (≈2GB):
                  {codeBox('ollama pull llama3.2')}
                  <span style={{ fontSize: '0.82rem' }}>Có thể thay bằng <code>qwen2.5</code>, <code>mistral</code>, <code>phi3</code>… Đổi model qua biến môi trường <code>OLLAMA_MODEL</code>.</span>
                </li>
                <li>Ollama tự chạy ở <code>http://127.0.0.1:11434</code>. Bấm <strong>Kiểm tra</strong> để xác nhận.</li>
              </ol>
            </div>

            <button onClick={checkLocal} disabled={checkingLocal} style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderRadius: '12px',
              backgroundColor: '#2563EB', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: checkingLocal ? 0.6 : 1
            }}>
              <RefreshCw size={18} /> {checkingLocal ? 'Đang kiểm tra…' : 'Kiểm tra model cục bộ'}
            </button>

            {localStatus && (
              <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)',
                backgroundColor: localStatus.available && localStatus.model_pulled ? '#E8F5E9' : '#FEF2F2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: localStatus.available && localStatus.model_pulled ? '#047857' : '#B91C1C' }}>
                  {localStatus.available && localStatus.model_pulled ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  {!localStatus.available
                    ? 'Chưa thấy Ollama đang chạy.'
                    : localStatus.model_pulled
                      ? `Sẵn sàng! Model "${localStatus.model}" đã tải.`
                      : `Ollama đang chạy nhưng chưa có model "${localStatus.model}".`}
                </div>
                {localStatus.available && !localStatus.model_pulled && (
                  <div style={{ fontSize: '0.85rem', color: '#92400E', marginTop: '6px' }}>Chạy <code>ollama pull {localStatus.model}</code> rồi kiểm tra lại.</div>
                )}
                {localStatus.models?.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>Model có sẵn: {localStatus.models.join(', ')}</div>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>Nếu model chưa sẵn sàng, ứng dụng tự động dùng thuật toán NLP.</div>
              </div>
            )}
          </div>
        )}

        {/* === Algorithm (offline NLP) === */}
        {engineMode === 'algorithm' && (
          <div style={{ backgroundColor: '#E8F5E9', borderLeft: '4px solid #3B6B59', padding: '20px', borderRadius: '0 12px 12px 0' }}>
            <h3 style={{ fontWeight: 700, color: '#047857', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
              <Sparkles size={18} /> Không cần cấu hình
            </h3>
            <p style={{ color: '#065F46', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              Mọi tính năng chạy bằng bộ máy NLP tích hợp (TextRank cho tóm tắt, pyvi cho tiếng Việt, cloze-deletion cho quiz, SM-2 cho flashcard). Hoàn toàn offline, không cần mạng hay API key — chất lượng cơ bản nhưng tức thì và miễn phí.
            </p>
          </div>
        )}

        {/* Save (all modes) */}
        <button onClick={handleSave} style={{
          marginTop: '28px', width: '100%', padding: '16px', borderRadius: '16px',
          backgroundColor: isSaved ? '#3B6B59' : '#8A334B', color: 'white', fontWeight: 700, fontSize: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease'
        }}>
          {isSaved ? <><CheckCircle2 size={20} /> Đã lưu cài đặt</> : <><Save size={20} /> Lưu cài đặt</>}
        </button>
      </div>
    </div>
  );
};

export default Settings;
