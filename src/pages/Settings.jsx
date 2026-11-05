import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, ShieldAlert, Server, Settings as SettingsIcon, Download, TerminalSquare, RefreshCw, XCircle, Sparkles, HardDrive, Cloud, Pin, LogIn, LogOut } from 'lucide-react';
import { getDriveApiKey, setDriveApiKey, DRIVE_KEY_STORAGE } from '../utils/googleDrive';
import * as drive from '../utils/googleDrive';
import { signInWithGoogle, signOutGoogle, getStoredUser } from '../utils/googleAuth';
import { getReminderSettings, REMINDER_KEY, getStreak } from '../components/SmartReminder';
import { BellRing } from 'lucide-react';

// Three interchangeable engines power EVERY AI feature (chat, quiz, flashcards, notes, concept
// map, roadmap...). The choice is encoded into localStorage['workflow_api_key'], which every
// modal/page already sends to the backend:
//   'ai'        -> the user's Gemini key (cloud)      -> backend uses Gemini
//   'local'     -> sentinel 'LOCAL'                   -> backend routes to a local Ollama model
//   'algorithm' -> sentinel 'OFFLINE'                 -> backend uses the deterministic NLP engine
const ENGINES = [
  { id: 'ai', title: 'Cloud API (Gemini)', color: 'var(--brand-primary)', bg: 'var(--surface-blush)', desc: 'Chất lượng cao nhất. Cần API key Google Gemini (miễn phí).' },
  { id: 'local', title: 'Model cục bộ (Ollama)', color: '#2563EB', bg: 'var(--surface-blue)', desc: 'Tải model AI về máy, chạy offline bằng CPU/GPU của bạn.' },
  { id: 'algorithm', title: 'Thuật toán (NLP)', color: '#3B6B59', bg: 'var(--surface-green)', desc: 'Bộ máy NLP tích hợp (TextRank, pyvi). Không cần cài đặt gì.' },
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

  // Google account: OAuth client (entered by the user) + sign-in status + pinned folders.
  const [gClient, setGClient] = useState(() => drive.getGoogleClient());
  const [gSetupOpen] = useState(() => !drive.getGoogleClient().clientId); // open until configured
  const [gSaved, setGSaved] = useState(false);
  const [gConnected, setGConnected] = useState(drive.isConnected());
  const [gUser, setGUser] = useState(getStoredUser());
  const [gBusy, setGBusy] = useState(false);
  const [gError, setGError] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinned, setPinned] = useState(drive.getPinnedFolders());
  useEffect(() => {
    const sync = () => { setGConnected(drive.isConnected()); setPinned(drive.getPinnedFolders()); };
    window.addEventListener(drive.AUTH_EVENT, sync);
    drive.restoreSession().then(sync);
    return () => window.removeEventListener(drive.AUTH_EVENT, sync);
  }, []);
  const saveGoogleClient = () => {
    drive.setGoogleClient(gClient);
    setGClient(drive.getGoogleClient());
    setGSaved(true);
    setTimeout(() => setGSaved(false), 2500);
  };
  const handleGoogleSignIn = async () => {
    drive.setGoogleClient(gClient);
    setGBusy(true); setGError('');
    try { setGUser(await signInWithGoogle()); } catch (e) { setGError(e.message || String(e)); }
    setGBusy(false);
  };
  const handleGoogleSignOut = async () => {
    await signOutGoogle();
    setGUser(null);
  };
  const handlePin = async () => {
    setGError('');
    try { await drive.pinFolder(pinInput); setPinInput(''); } catch (e) { setGError(e.message || String(e)); }
  };

  // Google Drive API key (entered by the user, kept only in this machine's localStorage).
  const [driveKey, setDriveKey] = useState(() => {
    try { return localStorage.getItem(DRIVE_KEY_STORAGE) || ''; } catch { return ''; }
  });
  const [driveSaved, setDriveSaved] = useState(false);
  const saveDriveKey = () => {
    setDriveApiKey(driveKey);
    setDriveSaved(true);
    setTimeout(() => setDriveSaved(false), 2500);
  };

  // Storage folder (desktop app): where the database and uploaded files live.
  const [reminders, setReminders] = useState(getReminderSettings());
  const saveReminders = (next) => {
    setReminders(next);
    try { localStorage.setItem(REMINDER_KEY, JSON.stringify(next)); } catch { /* storage off */ }
    window.dispatchEvent(new Event('reminders-changed'));
    if (next.enabled && 'Notification' in window && !window.workflowDesktop && Notification.permission === 'default') Notification.requestPermission();
  };
  const [dataDir, setDataDir] = useState('');
  const isDesktop = Boolean(window.workflowDesktop?.selectWorkspace);
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/system/info')
      .then(res => (res.ok ? res.json() : null))
      .then(d => d && setDataDir(d.data_dir))
      .catch(() => {});
  }, []);

  const handleSelectWorkspace = async () => {
    try {
      const res = await window.workflowDesktop.selectWorkspace();
      if (!res) return;
      const what = res.existing
        ? 'Thư mục này đã có dữ liệu Workflow — ứng dụng sẽ dùng dữ liệu đó.'
        : res.moved
          ? 'Đã sao chép tài liệu và cơ sở dữ liệu sang thư mục mới (bản cũ vẫn được giữ nguyên).'
          : 'Thư mục mới sẽ bắt đầu với dữ liệu trống.';
      if (window.confirm(`Thư mục lưu trữ: ${res.path}\n\n${what}\n\nKhởi động lại ứng dụng ngay để áp dụng?`)) {
        await window.workflowDesktop.relaunch();
      }
    } catch (err) {
      console.error(err);
      alert(`Không đổi được thư mục lưu trữ.\n${err.message || ''}`);
    }
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
              border: `2px solid ${engineMode === e.id ? e.color: 'var(--border-light)'}`,
              backgroundColor: engineMode === e.id ? e.bg : 'var(--bg-tertiary)',
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
                <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline', fontWeight: 600 }}>Google AI Studio → API Keys</a>.</li>
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
            <div style={{ backgroundColor: 'var(--surface-blue)', borderLeft: '4px solid #2563EB', padding: '20px', borderRadius: '0 12px 12px 0', marginBottom: '20px' }}>
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
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--border-light)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', appearance: 'auto' }}
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
          <div style={{ backgroundColor: 'var(--surface-green)', borderLeft: '4px solid #3B6B59', padding: '20px', borderRadius: '0 12px 12px 0' }}>
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

      <div data-testid="reminder-settings" style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <BellRing size={20} /> Nhắc nhở thông minh
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Khi có flashcard đến hạn ôn, Workflow gửi thông báo kèm một câu hỏi trắc nghiệm — xem thông báo cũng ôn được bài. Trả lời giữ chuỗi ngày học (hiện tại: {getStreak()} ngày 🔥).
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-navy)', fontWeight: 600 }}>
          <input type="checkbox" checked={reminders.enabled} onChange={e => saveReminders({ ...reminders, enabled: e.target.checked })} /> Bật nhắc nhở bằng quiz
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          Nhắc mỗi
          <select value={reminders.minutes} onChange={e => saveReminders({ ...reminders, minutes: Number(e.target.value) })} disabled={!reminders.enabled}
            style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)' }}>
            {[15, 30, 60, 120, 240].map(m => <option key={m} value={m}>{m < 60 ? `${m} phút` : `${m / 60} giờ`}</option>)}
          </select>
        </label>
        <button onClick={() => window.dispatchEvent(new Event('reminder-now'))} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-navy)', fontWeight: 600, cursor: 'pointer' }}>
          Thử ngay
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Cloud size={20} /> Tài khoản Google &amp; Google Drive
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
          Đăng nhập Google để mọi thư mục trong Drive của bạn (Drive của tôi, Được chia sẻ với tôi, Drive dùng chung) hiện ở thanh bên
          “Hub tài liệu”. Workflow chỉ xin quyền <strong>đọc</strong>.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <span data-testid="google-status" style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {gConnected
              ? <>Đã kết nối{gUser?.email ? <> với <strong>{gUser.email}</strong></> : ''}.</>
              : 'Chưa kết nối Google.'}
          </span>
          {gConnected ? (
            <button onClick={handleGoogleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}>
              <LogOut size={15} /> Ngắt kết nối
            </button>
          ) : (
            <button onClick={handleGoogleSignIn} disabled={gBusy || !gClient.clientId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 700, cursor: gClient.clientId ? 'pointer' : 'not-allowed', opacity: gBusy || !gClient.clientId ? 0.6 : 1 }}>
              <LogIn size={15} /> {gBusy ? (drive.isDesktop() ? 'Hoàn tất trong trình duyệt…' : 'Đang chờ Google…') : 'Đăng nhập Google'}
            </button>
          )}
        </div>
        {gError && <div style={{ fontSize: '0.85rem', color: 'var(--danger, #B91C1C)' }}>{gError}</div>}

        <details open={gSetupOpen} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text-navy)' }}>OAuth Client ID {gClient.clientId ? '(đã thiết lập)' : '(cần thiết lập một lần)'}</summary>
          <ol style={{ margin: '8px 0', paddingLeft: '20px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
            <li>Google Cloud Console → <strong>APIs &amp; Services</strong> → bật <strong>Google Drive API</strong>.</li>
            <li><strong>OAuth consent screen</strong>: chọn External, thêm email Gmail của bạn vào <strong>Test users</strong>.</li>
            <li><strong>Credentials → Create credentials → OAuth client ID</strong> → loại{' '}
              {drive.isDesktop()
                ? <strong>Desktop app</strong>
                : <><strong>Web application</strong>, thêm <code>{window.location.origin}</code> vào Authorized JavaScript origins</>}.</li>
            <li>Dán Client ID{drive.isDesktop() ? ' và Client secret' : ''} vào đây.</li>
          </ol>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={gClient.clientId} onChange={(e) => setGClient({ ...gClient, clientId: e.target.value })}
              placeholder="xxxxxxxx.apps.googleusercontent.com" autoComplete="off" aria-label="OAuth Client ID"
              style={{ flex: '1 1 260px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            {drive.isDesktop() && (
              <input type="password" value={gClient.clientSecret} onChange={(e) => setGClient({ ...gClient, clientSecret: e.target.value })}
                placeholder="Client secret (GOCSPX-…)" autoComplete="off" aria-label="OAuth Client secret"
                style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            )}
            <button onClick={saveGoogleClient} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: gSaved ? '#3B6B59' : '#8A334B', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              {gSaved ? 'Đã lưu' : 'Lưu'}
            </button>
          </div>
        </details>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-navy)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><Pin size={15} /> Ghim thư mục Drive</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 8px' }}>
            Dán liên kết một thư mục bất kỳ (của bạn hoặc thư viện công khai của trường/lớp) để nó luôn hiện ở thanh bên.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" aria-label="Liên kết thư mục Drive"
              style={{ flex: '1 1 260px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            <button onClick={handlePin} disabled={!pinInput.trim()} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--brand-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer' }}>Ghim</button>
          </div>
          {pinned.length > 0 && (
            <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {pinned.map(f => (
                <li key={f.id}>{f.name} <button onClick={() => drive.unpinFolder(f.id)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>bỏ ghim</button></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Cloud size={20} /> Google Drive API Key
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
          Không bắt buộc khi đã đăng nhập Google. Chỉ cần để mở thư mục Drive <em>công khai</em> khi chưa đăng nhập. Key chỉ lưu trên máy này.
          Tạo key tại <strong>Google Cloud Console → APIs &amp; Services → Credentials → Create credentials → API key</strong>,
          bật <strong>Google Drive API</strong> cho project, rồi giới hạn key chỉ dùng Drive API.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="password"
            value={driveKey}
            onChange={(e) => setDriveKey(e.target.value)}
            placeholder="AIza..."
            autoComplete="off"
            style={{ flex: '1 1 260px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', fontFamily: 'monospace' }}
          />
          <button onClick={saveDriveKey} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: driveSaved ? '#3B6B59' : '#8A334B', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            {driveSaved ? 'Đã lưu' : 'Lưu key'}
          </button>
        </div>
        {!driveKey && getDriveApiKey() && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Đang dùng key từ file .env (chế độ phát triển).</span>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <HardDrive size={20} /> Thư mục lưu trữ dữ liệu
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Cơ sở dữ liệu và các file tài liệu bạn tải lên được lưu tại đây. Có thể chọn một thư mục đồng bộ (Google Drive, iCloud, OneDrive…) để sao lưu.
        </p>
        <code style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', wordBreak: 'break-all' }}>
          {dataDir || 'Không kết nối được backend.'}
        </code>
        {isDesktop ? (
          <button onClick={handleSelectWorkspace} style={{ alignSelf: 'flex-start', padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--brand-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer' }}>
            Đổi thư mục lưu trữ…
          </button>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chỉ đổi được thư mục trong ứng dụng desktop.</span>
        )}
      </div>
    </div>
  );
};

export default Settings;
