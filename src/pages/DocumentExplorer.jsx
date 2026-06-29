import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, FileText, Download, Trash2, Eye, ArrowLeft, BrainCircuit, Cloud } from 'lucide-react';
import { getLocalFiles, saveLocalFile, deleteLocalFile } from '../utils/storage';
import DueFlashcardModal from '../components/modals/DueFlashcardModal';
import GoogleDriveModal from '../components/modals/GoogleDriveModal';

const DocumentExplorer = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [isDueModalOpen, setIsDueModalOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('Tất cả');

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

  const staticFolders = [
    { name: 'Đề cuối kỳ', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Đề cương Giải tích 1', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Giáo trình - Bài giảng', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Lý thuyết và giải đề cương', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Tóm tắt công thức', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' }
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
          Tài liệu được đồng bộ tự động mỗi 10 phút từ Google Drive, cache về MinIO và xem bằng viewer nội bộ của Workflow.
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
        <button onClick={() => { setSearch(''); setActiveTag('Tất cả'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '20px', color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> {q || activeTag !== 'Tất cả' ? 'Xem tất cả' : 'Lên thư mục cha'}
        </button>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ĐANG XEM</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>GIẢI TÍCH 1</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {(showFolders ? staticFolders.length : 0) + filteredFiles.length} mục
        </div>
      </div>

      {/* Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '32px' }}>
        
        {/* Folder shortcuts (filter by name) */}
        {showFolders && staticFolders.map((folder, i) => (
          <div key={i} onClick={() => setSearch(folder.name)} className="glass-card hover-lift" style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
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

      <DueFlashcardModal isOpen={isDueModalOpen} onClose={() => setIsDueModalOpen(false)} />
      <GoogleDriveModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} onImport={loadFiles} />
    </div>
  );
};

export default DocumentExplorer;
