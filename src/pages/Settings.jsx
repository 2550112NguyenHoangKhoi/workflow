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
  const [localRecommendation, setLocalRecommendation] = useState(null);
  const [selectedLocalModel, setSelectedLocalModel] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('workflow_gemini_key');
    const savedMode = localStorage.getItem('workflow_engine_mode');
    const savedApiKey = localStorage.getItem('workflow_api_key');
    if (savedKey) setApiKey(savedKey);
    if (savedMode) setEngineMode(savedMode);
    if (savedApiKey && savedApiKey.startsWith('LOCAL:')) {
      setSelectedLocalModel(savedApiKey.replace('LOCAL:', ''));
    }
  }, []);

  useEffect(() => {
    if (engineMode === 'local' && !localRecommendation) {
      fetch('http://127.0.0.1:8000/api/engine/recommend_local')
        .then(res => res.json())
        .then(data => {
          setLocalRecommendation(data);
          if (!selectedLocalModel) {
            setSelectedLocalModel(data.recommended_model);
          }
        })
        .catch(err => console.error("Could not fetch recommendation:", err));
    }
  }, [engineMode]);

  const handleSave = () => {
    const key = apiKey.trim();
    localStorage.setItem('workflow_gemini_key', key);
    localStorage.setItem('workflow_engine_mode', engineMode);
    // Encode the engine choice into the signal every API call already sends.
    const signal = engineMode === 'algorithm' ? 'OFFLINE' : engineMode === 'local' ? (selectedLocalModel ? `LOCAL:${selectedLocalModel}` : 'LOCAL') : key;
    localStorage.setItem('workflow_api_key', signal);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const checkLocal = async () => {
    setCheckingLocal(true);
    setLocalStatus(null);
    try {
      const url = selectedLocalModel ? `http://127.0.0.1:8000/api/engine/local_status?model_name=${encodeURIComponent(selectedLocalModel)}` : 'http://127.0.0.1:8000/api/engine/local_status';
      const res = await fetch(url);
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
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <SettingsIcon size={32} color="#8A334B" />
          Cài đặt hệ thống
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Cấu hình bộ máy AI cho mọi tính năng học tập của hệ thống.</p>
      </div>

      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} />
            Mô hình AI Mặc định
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Áp dụng cho toàn bộ tính năng: AI Assistant, tạo quiz, flashcard, smart notes, concept map, lộ trình học. Có thể đổi bất cứ lúc nào.
          </p>
        </div>

        {/* Engine picker — 3 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          {ENGINES.map((e) => (
            <div key={e.id} onClick={() => setEngineMode(e.id)} style={{
              border: `2px solid ${engineMode === e.id ? e.color : 'var(--border-light)'}`,
              backgroundColor: engineMode === e.id ? e.bg : 'white',
              padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s'
            }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '6px' }}>{e.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '0 -32px 28px' }}></div>

        {/* === Cloud API (Gemini) === */}
        {engineMode === 'ai' && (
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Key size={22} color="#8A334B" /> Google Gemini API Key
            </h2>
            <div style={{ backgroundColor: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: '20px', borderRadius: '0 12px 12px 0', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: 700, color: '#B45309', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                <ShieldAlert size={18} /> Cách lấy API Key miễn phí:
              </h3>
              <ol style={{ paddingLeft: '24px', color: '#92400E', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#8A334B', textDecoration: 'underline', fontWeight: 600 }}>Google AI Studio → API Keys</a>.</li>
                <li>Đăng nhập bằng tài khoản Google của bạn. Đảm bảo bạn đã đồng ý với các điều khoản sử dụng của Google AI Studio nếu đây là lần đầu truy cập.</li>
                <li>Nhấn nút <strong>"Create API Key"</strong> màu xanh ở góc trên bên trái màn hình.</li>
                <li>Hệ thống sẽ yêu cầu chọn một dự án (Project). Bạn có thể chọn project có sẵn hoặc nhấn <strong>"Create API key in a new project"</strong>.</li>
                <li>Sau khi tạo thành công, một bảng chứa mã API Key sẽ hiện ra. Copy toàn bộ đoạn mã (thường bắt đầu bằng <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FCD34D', color: 'var(--text-navy)', fontWeight: 'bold' }}>AIzaSy...</code>)</li>
                <li>Dán đoạn mã vừa copy vào ô "Mã API Key của bạn" ở bên dưới.</li>
                <li>Nhấn nút <strong>Lưu cài đặt</strong> ở cuối trang. Hệ thống sẽ ngay lập tức kết nối và sử dụng Gemini cho toàn bộ tính năng học tập. <br/><span style={{ fontSize: '0.85rem', opacity: 0.9 }}>* Lưu ý: Gemini API hiện tại cung cấp gói miễn phí (Free Tier) rất hào phóng, đủ để sử dụng thoải mái cho mục đích cá nhân.</span></li>
              </ol>
            </div>
            <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-navy)' }}>Mã API Key của bạn</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..........................."
              style={{ width: '100%', marginTop: '8px', padding: '16px', borderRadius: '16px', border: '2px solid var(--border-light)', color: 'var(--text-navy)', fontFamily: 'monospace', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Key lưu trên thiết bị của bạn và chỉ gửi tới máy chủ Google.</p>
          </div>
        )}

        {/* === Local model (Ollama) === */}
        {engineMode === 'local' && (
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={22} color="#2563EB" /> Tải & chạy model AI cục bộ
            </h2>
            <div style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #2563EB', padding: '20px', borderRadius: '0 12px 12px 0', marginBottom: '20px' }}>
              {localRecommendation && (
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#DBEAFE', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E40AF', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} /> Gợi ý cho máy của bạn
                  </h3>
                  <p style={{ color: '#1E3A8A', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                    {localRecommendation.reasoning}
                  </p>
                </div>
              )}
              
              <ol style={{ paddingLeft: '24px', color: '#1E40AF', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                <li>Truy cập trang chủ của <a href="https://ollama.com/download" target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', textDecoration: 'underline', fontWeight: 600 }}>Ollama</a> và tải bản cài đặt tương ứng với hệ điều hành của bạn (macOS / Windows / Linux). Tiến hành cài đặt như các phần mềm thông thường.</li>
                <li>Sau khi cài đặt xong, hãy chạy phần mềm Ollama (bạn sẽ thấy biểu tượng Ollama xuất hiện ở thanh trạng thái hoặc taskbar).</li>
                <li>Mở ứng dụng <strong>Terminal</strong> (trên macOS/Linux) hoặc <strong>Command Prompt/PowerShell</strong> (trên Windows).</li>
                <li>Copy lệnh dưới đây và dán vào Terminal để tải model AI về máy (Quá trình tải có thể mất từ 5-15 phút tùy thuộc vào tốc độ mạng, dung lượng thường từ 2GB đến 8GB):
                  {codeBox(`ollama pull ${selectedLocalModel || 'gemma2:9b'}`)}
                  <span style={{ fontSize: '0.82rem' }}>* Lưu ý: Lệnh này sẽ tự động thay đổi dựa trên model bạn chọn ở danh sách bên dưới.</span>
                </li>
                <li>Chờ đến khi Terminal chạy xong và báo "success". Lúc này Ollama đã tự động lưu trữ model và chạy ngầm ở địa chỉ <code>http://127.0.0.1:11434</code>.</li>
                <li>Quay lại màn hình này, cuộn xuống và nhấn nút <strong>Kiểm tra model cục bộ</strong> để ứng dụng quét xác nhận model đã sẵn sàng, sau đó nhấn <strong>Lưu cài đặt</strong>.</li>
              </ol>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-navy)', display: 'block', marginBottom: '8px' }}>Chọn Model AI</label>
              <select 
                value={selectedLocalModel}
                onChange={(e) => setSelectedLocalModel(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--border-light)', fontSize: '1rem', outline: 'none', backgroundColor: 'white', color: 'var(--text-navy)', appearance: 'auto' }}
              >
                <option value="gemma2">gemma2 (Gợi ý cho máy &gt; 8GB RAM)</option>
                <option value="gemma2:2b">gemma2:2b (Nhẹ, máy &lt; 8GB RAM)</option>
                <option value="qwen2.5:14b">qwen2.5:14b (Siêu tốt, máy &gt; 16GB RAM)</option>
                <option value="qwen2.5">qwen2.5 (7B - Cân bằng)</option>
                <option value="qwen2.5:3b">qwen2.5:3b (Nhẹ)</option>
                <option value="llama3.1">llama3.1 (8B)</option>
                <option value="llama3.2">llama3.2 (3B)</option>
                <option value="mistral">mistral (7B)</option>
                {selectedLocalModel && !["gemma2", "gemma2:2b", "qwen2.5:14b", "qwen2.5", "qwen2.5:3b", "llama3.1", "llama3.2", "mistral"].includes(selectedLocalModel) && (
                  <option value={selectedLocalModel}>{selectedLocalModel} (Tùy chỉnh)</option>
                )}
              </select>
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
