import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Folder, FileText, Download, Trash2, Eye, ArrowLeft, BrainCircuit, Cloud, PlusCircle, CheckCircle2, Share2 } from 'lucide-react';
import { getLocalFiles, saveLocalFile, deleteLocalFile } from '../utils/storage';
import * as drive from '../utils/googleDrive';
import { toggleSource, isSelected } from '../utils/examSources';
import DueFlashcardModal from '../components/modals/DueFlashcardModal';
import GoogleDriveModal from '../components/modals/GoogleDriveModal';

const DocumentExplorer = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?folder=<Google Drive folder id> switches the page into Drive-browsing mode
  // (e.g. /documents?folder=1VTmwR9iVndmKvI2O3jiHPlAu0OBnWPir). 'root' = My Drive.
  const folderId = searchParams.get('folder');
  const [files, setFiles] = useState([]);
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [isDueModalOpen, setIsDueModalOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('Tất cả');
  const [driveItems, setDriveItems] = useState(null);   // { folders, files } of the current Drive folder
  const [driveName, setDriveName] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(() => new Set());
  const [, bumpSelection] = useState(0); // re-render after (de)selecting an exam source

  const handleToggleSource = (e, src) => {
    e.stopPropagation();
    toggleSource(src);
    bumpSelection(v => v + 1);
  };

  const loadFiles = () => {
    fetch('http://127.0.0.1:8000/api/documents')
      .then(res => res.json())
      .then(data => {
        if (data.documents) {
          const mapped = data.documents.map(d => {
            const lower = d.filename.toLowerCase();
            const type = lower.endsWith('.pdf') ? 'pdf' : lower.endsWith('.md') ? 'md' : 'txt';
            return {
              id: d.id,
              name: d.filename,
              type,
              content: d.content,
              date: new Date(d.upload_date).toLocaleDateString(),
              size: `${(d.content.length / 1024).toFixed(1)} KB`
            };
          });
          setFiles(mapped);
        }
      })
      .catch(err => console.error(err));

    fetch('http://127.0.0.1:8000/api/flashcards/due')
      .then(res => res.json())
      .then(data => setDueCardsCount(data.flashcards?.length || 0))
      .catch(err => console.error(err));
  };

  useEffect(() => { loadFiles(); }, [isDueModalOpen]);

  // Load the Drive folder named in the URL. The public library works with just the API
  // key (no OAuth) — like the reference product. Private folders ('root' or the user's
  // own) still go through the consent popup, triggered by the connect button below.
  const loadDriveFolder = async (id, { connect = false } = {}) => {
    setDriveLoading(true);
    setDriveError('');
    try {
      if (connect && !drive.isConnected()) await drive.connectDrive();
      let realId = id;
      let name = 'Google Drive của tôi';
      if (id !== 'root') {
        // getFileMeta resolves Drive shortcuts, so listing uses the target folder.
        const meta = await drive.getFileMeta(id).catch(() => null);
        if (meta) { realId = meta.id; name = meta.name; }
      }
      setDriveItems(await drive.listChildren(realId));
      setDriveName(name);
    } catch (e) {
      setDriveError(e.message || String(e));
      setDriveItems(null);
    }
    setDriveLoading(false);
  };

  useEffect(() => {
    if (!folderId) { setDriveItems(null); setDriveName(''); setDriveError(''); return; }
    if (folderId === 'root' && !drive.isConnected()) { setDriveItems(null); setDriveName(''); return; }
    loadDriveFolder(folderId);
  }, [folderId]);

  // ?q=<text> seeds the library search — used by the global Topbar search pill.
  const urlQuery = searchParams.get('q');
  useEffect(() => {
    if (urlQuery !== null) setSearch(urlQuery);
  }, [urlQuery]);

  // Auto-refresh the live Drive library every 10 minutes while browsing it.
  useEffect(() => {
    if (!folderId) return;
    const iv = setInterval(() => { if (drive.isConnected() || folderId !== 'root') loadDriveFolder(folderId); }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [folderId]);

  const handleImport = async (file) => {
    setImportingId(file.id);
    try {
      await drive.importFileToLibrary(file);
      setImportedIds(prev => new Set(prev).add(file.id));
      loadFiles();
    } catch (e) {
      alert('Nhập thất bại: ' + (e.message || e));
    }
    setImportingId(null);
  };

  // Import every file in the current Drive folder, sequentially so the backend
  // parses one PDF at a time. Failures are collected instead of aborting the batch.
  const handleImportAll = async () => {
    const pending = (driveItems?.files || []).filter(f => !importedIds.has(f.id));
    if (pending.length === 0) return;
    const failed = [];
    for (const f of pending) {
      setImportingId(f.id);
      try {
        await drive.importFileToLibrary(f);
        setImportedIds(prev => new Set(prev).add(f.id));
      } catch {
        failed.push(f.name);
      }
    }
    setImportingId(null);
    loadFiles();
    if (failed.length) alert(`Không nhập được ${failed.length} file:\n` + failed.join('\n'));
  };

  const handleDelete = async (e, file) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa tài liệu "${file.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/documents/${file.id}`, { method: 'DELETE' });
      if (res.ok) loadFiles();
      else alert('Xóa thất bại.');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa tài liệu.');
    }
  };

  const handleDownload = (e, file) => {
    e.stopPropagation();
    const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, '.txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tags = ["Tất cả", "HCMUS", "ĐHBK-HCM", "TDTU", "FTU", "Khác"];
  const q = search.trim().toLowerCase();
  const filteredFiles = files.filter(f =>
    !q || f.name.toLowerCase().includes(q) || (f.content || '').toLowerCase().includes(q)
  );
  const showFolders = !q && activeTag === 'Tất cả';

  // Real folders from the public GIẢI TÍCH 1 library (Drive shortcut ids; resolved on open).
  const staticFolders = [
    { id: '1uuuOZlyZmbDoRrz0yuW6FsTm3oFu5vrP', name: 'Đề cuối kỳ', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST)/GIẢI TÍCH 1' },
    { id: '19O2TCOvcItFzCDRaZsiHPzcpvPkDVgBC', name: 'Đề cương Giải tích 1', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST)/GIẢI TÍCH 1' },
    { id: '1ZszCTJzaA3AtsKtINjEKSZwuxq56nDxr', name: 'Giáo trình - Bài giảng', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST)/GIẢI TÍCH 1' },
    { id: '1bGX1jgO7rhl1Nz69uJtX3GYhW7KRy1VF', name: 'Lý thuyết và giải đề cương', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST)/GIẢI TÍCH 1' },
    { id: '1Wl3trbhxN-RiS4109V6qEmsIF8wWMTzv', name: 'Tóm tắt công thức', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST)/GIẢI TÍCH 1' }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px 48px' }}>
      
      {/* Header Info */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-secondary)', letterSpacing: '0.1em', marginBottom: '8px' }}>
          ✨ KHÁM PHÁ TÀI LIỆU
        </h4>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Thư viện Học thuật
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
          Thư viện đọc trực tiếp từ Google Drive công khai (tự làm mới mỗi 10 phút) và xem bằng viewer nội bộ của Workflow.
        </p>
      </div>

      {/* Spaced Repetition Due Widget */}
      {dueCardsCount > 0 && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '24px', padding: '20px 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: '#D1FAE5', color: '#059669', padding: '12px', borderRadius: '16px' }}>
              <BrainCircuit size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#064E3B' }}>Đến Hạn Ôn Tập</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#047857' }}>Bạn có <strong>{dueCardsCount}</strong> thẻ ghi nhớ cần ôn tập (Spaced Repetition).</p>
            </div>
          </div>
          <button onClick={() => setIsDueModalOpen(true)} style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)' }}>
            Ôn Tập Ngay
          </button>
        </div>
      )}

      {/* Search Bar & Filters */}
      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '24px', padding: '16px 24px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm tài liệu, giáo trình, ..."
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem', color: 'var(--text-primary)' }}
            />
          </div>
          <button style={{ backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Search size={20} />
          </button>
          <button onClick={() => setIsDriveOpen(true)} title="Nhập cả thư mục (máy tính / Google Drive)" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '12px', height: '48px', padding: '0 18px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
            <Cloud size={18} /> Nhập thư mục
          </button>
          <button onClick={() => setSearchParams({ folder: drive.LIBRARY_ROOT })} title="Duyệt thư viện học liệu (Google Drive công khai)" style={{ backgroundColor: folderId ? 'var(--brand-primary)' : 'var(--bg-tertiary)', color: folderId ? 'white' : 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '12px', height: '48px', padding: '0 18px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
            <Folder size={18} /> Duyệt Drive
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag)} style={{
              padding: '8px 20px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              backgroundColor: tag === activeTag ? 'var(--text-primary)' : 'transparent',
              color: tag === activeTag ? 'var(--bg-tertiary)' : 'var(--text-secondary)',
              border: tag === activeTag ? 'none' : '1px solid var(--border-medium)',
            }}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Breadcrumb & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        {folderId ? (
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '20px', color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            <ArrowLeft size={16} /> Quay lại
          </button>
        ) : (
          <button onClick={() => { setSearch(''); setActiveTag('Tất cả'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '20px', color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            <ArrowLeft size={16} /> {q || activeTag !== 'Tất cả' ? 'Xem tất cả' : 'Lên thư mục cha'}
          </button>
        )}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ĐANG XEM</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {folderId ? (driveName || 'GOOGLE DRIVE') : 'GIẢI TÍCH 1'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {folderId && driveItems && driveItems.files.some(f => !importedIds.has(f.id)) && (
            <button onClick={handleImportAll} disabled={importingId !== null} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: importingId !== null ? 0.6 : 1 }}>
              <PlusCircle size={14} /> {importingId !== null ? 'Đang nhập…' : `Nhập tất cả (${driveItems.files.filter(f => !importedIds.has(f.id)).length})`}
            </button>
          )}
          <span>
            {folderId
              ? (driveItems ? `${driveItems.folders.length + driveItems.files.length} mục` : '')
              : `${(showFolders ? staticFolders.length : 0) + filteredFiles.length} mục`}
          </span>
        </div>
      </div>

      {/* === Google Drive browsing mode (?folder=<id>) === */}
      {folderId && (
        <div style={{ paddingBottom: '32px' }}>
          {!drive.isConfigured() && (
            <div style={{ padding: '24px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '16px', color: '#B91C1C', fontSize: '0.9rem' }}>
              Chưa cấu hình <code>VITE_GOOGLE_OAUTH_CLIENT_ID</code> trong <code>.env</code> nên không thể duyệt Google Drive.
            </div>
          )}
          {drive.isConfigured() && !driveItems && !driveLoading && (
            <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)', borderRadius: '24px' }}>
              <Cloud size={40} color="var(--brand-primary)" style={{ marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 8px', fontWeight: 800, color: 'var(--text-primary)' }}>Kết nối Google Drive để mở thư mục này</h3>
              {driveError && <p style={{ color: '#B91C1C', fontSize: '0.85rem', maxWidth: '520px', margin: '0 auto 12px' }}>{driveError}</p>}
              <button onClick={() => loadDriveFolder(folderId, { connect: true })} style={{ backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                Kết nối &amp; mở thư mục
              </button>
            </div>
          )}
          {driveLoading && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontWeight: 600 }}>Đang tải thư mục từ Google Drive…</div>
          )}
          {driveItems && !driveLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {driveItems.folders.map(f => (
                <div key={f.id} onClick={() => setSearchParams({ folder: f.id })} className="glass-card hover-lift" style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--border-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                      <Folder size={24} />
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{f.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>GOOGLE DRIVE</p>
                </div>
              ))}
              {driveItems.files.map(f => (
                <div key={f.id} className="glass-card hover-lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Real first-page thumbnail from Drive's public thumbnail endpoint */}
                  <div style={{ height: '140px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={drive.publicThumbUrl(f.id)} alt="" loading="lazy" referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                      onError={(e) => { e.target.style.display = 'none'; }} />
                    <FileText size={48} color="var(--border-medium)" opacity={0.5} style={{ position: 'absolute', zIndex: 0 }} />
                    <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }}>
                      {(f.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                    </div>
                    <input type="checkbox" checked={isSelected('drive', f.id)}
                      onChange={(e) => handleToggleSource(e, { type: 'drive', value: String(f.id), name: f.name })}
                      onClick={(e) => e.stopPropagation()}
                      title="Chọn làm nguồn tạo đề thi / tài liệu phòng thi"
                      style={{ position: 'absolute', top: '12px', left: '12px', width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }} />
                  </div>
                  <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.name}</h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driveName}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', marginBottom: '14px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('vi-VN') : ''}</span>
                      <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Sẵn sàng</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => navigate(`/drive/${f.id}?name=${encodeURIComponent(f.name)}&folder=${folderId}`)} style={{ flex: 1, backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <Eye size={16} /> Xem ngay
                      </button>
                      <a href={drive.publicDownloadUrl(f.id)} target="_blank" rel="noreferrer" title="Tải file gốc" style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
                        <Download size={16} />
                      </a>
                      <button onClick={() => { navigator.clipboard.writeText(drive.publicShareUrl(f.id)); alert('Đã sao chép liên kết chia sẻ!'); }} title="Chia sẻ (sao chép liên kết)" style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <Share2 size={16} />
                      </button>
                      <button onClick={() => handleImport(f)} disabled={importingId === f.id || importedIds.has(f.id)} title={importedIds.has(f.id) ? 'Đã nhập vào thư viện' : 'Nhập vào thư viện để dùng AI'} style={{ width: '40px', height: '40px', backgroundColor: importedIds.has(f.id) ? 'var(--success-bg)' : 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: importedIds.has(f.id) ? 'var(--success)' : 'var(--brand-primary)', cursor: 'pointer', opacity: importingId === f.id ? 0.5 : 1 }}>
                        {importedIds.has(f.id) ? <CheckCircle2 size={16} /> : <PlusCircle size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {driveItems.folders.length === 0 && driveItems.files.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Thư mục này trống.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid Content */}
      {!folderId && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '32px' }}>

        {/* Folder shortcuts into the public Drive library */}
        {showFolders && staticFolders.map((folder, i) => (
          <div key={i} onClick={() => setSearchParams({ folder: folder.id })} className="glass-card hover-lift" style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--border-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                <Folder size={24} />
              </div>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{folder.name}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{folder.school}</p>
          </div>
        ))}

        {/* Real Uploaded Files */}
        {filteredFiles.map(file => (
          <div key={file.id} className="glass-card hover-lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* File Preview Header (Mock) */}
            <div style={{ height: '140px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }}>
                {file.type.toUpperCase()}
              </div>
              <input type="checkbox" checked={isSelected('document', file.id)}
                onChange={(e) => handleToggleSource(e, { type: 'document', value: String(file.id), name: file.name })}
                onClick={(e) => e.stopPropagation()}
                title="Chọn làm nguồn tạo đề thi / tài liệu phòng thi"
                style={{ position: 'absolute', top: '12px', left: '12px', width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }} />
              <FileText size={48} color="var(--border-medium)" opacity={0.5} />
            </div>
            
            <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {file.name}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px' }}>
                THƯ VIỆN CÁ NHÂN
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {file.date}
                </div>
                <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>
                  Sẵn sàng
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => navigate(`/document/${file.id}`)} style={{ flex: 1, backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <Eye size={16} /> Xem ngay
                </button>
                <button onClick={(e) => handleDownload(e, file)} title="Tải xuống văn bản" style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Download size={16} />
                </button>
                <button onClick={(e) => handleDelete(e, file)} title="Xóa tài liệu" style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid #FCA5A5', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#DC2626', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      <DueFlashcardModal isOpen={isDueModalOpen} onClose={() => setIsDueModalOpen(false)} />
      <GoogleDriveModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} onImport={loadFiles} />
    </div>
  );
};

export default DocumentExplorer;
