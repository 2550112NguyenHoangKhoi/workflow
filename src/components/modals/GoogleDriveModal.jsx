import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, FileText, Download, Loader2, Cloud, ChevronRight, CheckCircle2, AlertCircle, FolderUp } from 'lucide-react';
import {
  isConfigured, isConnected, connectDrive, listChildren, importFileToLibrary,
} from '../../utils/googleDrive';

const GoogleDriveModal = ({ isOpen, onClose, onImport }) => {
  // --- Local folder bulk import (no Google login needed) ---
  const folderInputRef = useRef(null);
  const [uploading, setUploading] = useState(null); // {done,total} | null
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, [isOpen]);

  const handleFolderFiles = async (e) => {
    const all = Array.from(e.target.files || []);
    const docs = all.filter((f) => /\.(pdf|txt|md)$/i.test(f.name));
    e.target.value = '';
    if (!docs.length) { setError('Thư mục không có tệp PDF/TXT/MD nào.'); return; }
    setError(null);
    setUploading({ done: 0, total: docs.length });
    let ok = 0;
    for (let i = 0; i < docs.length; i++) {
      try {
        const form = new FormData();
        form.append('file', docs[i]);
        const res = await fetch('http://127.0.0.1:8000/api/documents/upload', { method: 'POST', body: form });
        if (res.ok) ok++;
      } catch { /* skip bad file */ }
      setUploading({ done: i + 1, total: docs.length });
    }
    setUploading(null);
    setImportedCount(ok);
    onImport?.();
  };

  // --- Google Drive (OAuth) ---
  const [connected, setConnected] = useState(isConnected());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [path, setPath] = useState([{ id: 'root', name: 'My Drive' }]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState({});

  const browse = async (folderId) => {
    setLoading(true); setError(null);
    try {
      const { folders: fo, files: fi } = await listChildren(folderId);
      setFolders(fo); setFiles(fi);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen && connected) browse(path[path.length - 1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, connected]);

  const handleConnect = async () => {
    setError(null);
    try { await connectDrive(); setConnected(true); }
    catch (err) { setError(err.message); }
  };

  const openFolder = (folder) => { setPath((p) => [...p, { id: folder.id, name: folder.name }]); browse(folder.id); };
  const goToCrumb = (idx) => { const next = path.slice(0, idx + 1); setPath(next); browse(next[next.length - 1].id); };

  const handleImport = async (file) => {
    setImporting((s) => ({ ...s, [file.id]: 'loading' }));
    try {
      await importFileToLibrary(file);
      setImporting((s) => ({ ...s, [file.id]: 'done' }));
      onImport?.();
    } catch (err) {
      setError(err.message);
      setImporting((s) => { const n = { ...s }; delete n[file.id]; return n; });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(27,42,78,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="animate-fade-in" style={{ backgroundColor: '#FCFAF8', borderRadius: '24px', width: '680px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#8A334B', padding: '10px', borderRadius: '12px' }}><FolderUp color="white" size={22} /></div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1B2A4E', margin: 0 }}>Nhập tài liệu hàng loạt</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Từ thư mục máy tính hoặc Google Drive</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* === Section 1: local folder bulk import (works instantly) === */}
          <div style={{ border: '2px solid var(--brand-secondary)', borderRadius: '16px', padding: '20px', backgroundColor: '#F0F7F4', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#1B2A4E', marginBottom: '6px' }}>
              <FolderUp size={18} color="var(--brand-secondary)" /> Tải lên cả thư mục
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-secondary)', backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '10px' }}>KHÔNG CẦN ĐĂNG NHẬP</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Chọn một thư mục trên máy (kể cả thư mục Google Drive đã đồng bộ) — toàn bộ PDF/TXT/MD sẽ được nhập tự động.
            </p>
            <input ref={folderInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFolderFiles} />
            {uploading ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-secondary)', marginBottom: '6px' }}>
                  <span>Đang nhập… {uploading.done}/{uploading.total}</span>
                  <span>{Math.round((uploading.done / uploading.total) * 100)}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#D1FAE5', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(uploading.done / uploading.total) * 100}%`, backgroundColor: 'var(--brand-secondary)', transition: 'width 0.2s' }} />
                </div>
              </div>
            ) : (
              <button onClick={() => folderInputRef.current?.click()} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand-secondary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <FolderUp size={18} /> Chọn thư mục để nhập
              </button>
            )}
            {importedCount > 0 && !uploading && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} /> Đã nhập {importedCount} tài liệu vào thư viện!
              </div>
            )}
          </div>

          {/* === Section 2: Google Drive (OAuth) === */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} /> HOẶC TỪ GOOGLE DRIVE <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
          </div>

          {!isConfigured() ? (
            <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Chưa cấu hình OAuth Client ID.</div>
          ) : !connected ? (
            <div style={{ textAlign: 'center', padding: '8px 16px' }}>
              <button onClick={handleConnect} style={{ padding: '12px 24px', backgroundColor: 'white', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} /> Kết nối Google Drive
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Cần thêm email của bạn vào "Test users" trong Google Cloud Console.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '0.85rem' }}>
                {path.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {i > 0 && <ChevronRight size={14} color="var(--text-muted)" />}
                    <button onClick={() => goToCrumb(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === path.length - 1 ? '#1B2A4E' : 'var(--brand-primary)', fontWeight: i === path.length - 1 ? 700 : 600 }}>{c.name}</button>
                  </React.Fragment>
                ))}
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', color: 'var(--brand-primary)' }}>
                  <Loader2 size={28} className="animate-spin" style={{ marginBottom: '12px' }} /><div style={{ fontWeight: 600 }}>Đang tải…</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {folders.map((f) => (
                    <button key={f.id} onClick={() => openFolder(f)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left' }}>
                      <Folder size={18} color="var(--brand-primary)" /><span style={{ flex: 1, fontWeight: 600, color: '#1B2A4E', fontSize: '0.9rem' }}>{f.name}</span><ChevronRight size={16} color="var(--text-muted)" />
                    </button>
                  ))}
                  {files.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'white', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                      <FileText size={18} color="var(--text-muted)" /><span style={{ flex: 1, color: '#1B2A4E', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      {importing[f.id] === 'done' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700 }}><CheckCircle2 size={16} /> Đã nhập</span>
                      ) : (
                        <button onClick={() => handleImport(f)} disabled={importing[f.id] === 'loading'} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F3EAE3', color: 'var(--brand-primary)', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                          {importing[f.id] === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Nhập
                        </button>
                      )}
                    </div>
                  ))}
                  {folders.length === 0 && files.length === 0 && (<div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Thư mục trống.</div>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveModal;
