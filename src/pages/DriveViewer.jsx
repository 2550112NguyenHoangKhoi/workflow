import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, Sparkles } from 'lucide-react';
import { getFileMeta, publicPreviewUrl, publicDownloadUrl, restoreSession, fileObjectUrl } from '../utils/googleDrive';
import CreateExamModal from '../components/modals/CreateExamModal';

// Full-page viewer for a Drive file: toolbar (back, title, Tạo đề thi ngay, Làm mới, Tải file
// gốc) over the file. When signed in to Google, the file is fetched with the user's token and
// shown from a blob: URL (works for private files and in the desktop app, where the Drive
// preview iframe has no Google cookies). Otherwise the public Drive preview iframe is used.
// Google Docs/Sheets/Slides are exported to PDF; formats the browser can't render inline
// (e.g. .docx) fall back to the Drive preview.
const INLINE = /^(application\/pdf|text\/|image\/|application\/vnd\.google-apps\.(document|spreadsheet|presentation|drawing))/;
const DriveViewer = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(searchParams.get('name') || '');
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mime, setMime] = useState(searchParams.get('mime') || '');
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let url = null;
    let cancelled = false;
    setBlobUrl(null); setLoadError('');
    (async () => {
      if (!(await restoreSession())) return; // signed out: public preview iframe
      try {
        let type = mime;
        if (!type) {
          const meta = await getFileMeta(fileId);
          type = meta.mimeType; if (!cancelled) { setMime(type); if (!name) setName(meta.name); }
        }
        if (!INLINE.test(type)) return;
        url = await fileObjectUrl({ id: fileId, mimeType: type, name });
        if (!cancelled) setBlobUrl(url);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [fileId, reloadKey]);

  useEffect(() => {
    if (!name) {
      getFileMeta(fileId).then(meta => setName(meta.name)).catch(() => setName('Tài liệu'));
    }
  }, [fileId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 20px', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} title="Quay lại" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Đang tải…'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bản xem trước PDF đã sẵn sàng · Cuộn liên tục</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button onClick={() => setIsExamOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
            <Sparkles size={15} /> Tạo đề thi ngay
          </button>
          <button onClick={() => setReloadKey(k => k + 1)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
            <RefreshCw size={15} /> Làm mới
          </button>
          <a href={blobUrl || publicDownloadUrl(fileId)} download={blobUrl ? (name || 'file') : undefined} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: 'var(--btn-navy)', color: 'white', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}>
            <Download size={15} /> Tải file gốc
          </a>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '8px 20px', fontSize: '0.8rem', color: 'var(--danger, #B91C1C)', backgroundColor: 'var(--bg-secondary)' }}>
          Không tải được tệp bằng tài khoản Google ({loadError}) — đang dùng bản xem trước công khai.
        </div>
      )}
      {/* The file itself (blob) when signed in; else Drive's public preview (own zoom/pager) */}
      <iframe
        key={`${reloadKey}-${blobUrl ? 'blob' : 'public'}`}
        src={blobUrl || publicPreviewUrl(fileId)}
        title={name}
        allow="autoplay"
        style={{ flex: 1, border: 'none', width: '100%' }}
      />

      <CreateExamModal isOpen={isExamOpen} onClose={() => setIsExamOpen(false)} />
    </div>
  );
};

export default DriveViewer;
