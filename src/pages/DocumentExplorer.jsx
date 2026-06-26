import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, FileText, Download, Share2, Eye, ArrowLeft } from 'lucide-react';
import { getLocalFiles, saveLocalFile, deleteLocalFile } from '../utils/storage';

const DocumentExplorer = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);

  useEffect(() => {
    setFiles(getLocalFiles());
  }, []);

  const tags = ["Tất cả", "HCMUS", "ĐHBK-HCM", "TDTU", "FTU", "Khác"];
  const currentTag = "Tất cả";

  const staticFolders = [
    { name: 'Đề cuối kỳ', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Đề cương Giải tích 1', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Giáo trình - Bài giảng', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Lý thuyết và giải đề cương', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' },
    { name: 'Tóm tắt công thức', school: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI...' }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header Info */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-secondary)', letterSpacing: '0.1em', marginBottom: '8px' }}>
          ✨ KHÁM PHÁ TÀI LIỆU
        </h4>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1B2A4E', marginBottom: '16px' }}>
          Thư viện Học thuật
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
          Tài liệu được đồng bộ tự động mỗi 10 phút từ Google Drive, cache về MinIO và xem bằng viewer nội bộ của Workflow.
        </p>
      </div>

      {/* Search Bar & Filters */}
      <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '24px', padding: '16px 24px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#FDF8F5', borderRadius: '12px', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
            <input 
              type="text" 
              placeholder="Tìm kiếm tài liệu, giáo trình, ..." 
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem', color: 'var(--text-primary)' }} 
            />
          </div>
          <button style={{ backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Search size={20} />
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <button key={tag} style={{
              padding: '8px 20px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              backgroundColor: tag === currentTag ? '#1C1C1C' : 'transparent',
              color: tag === currentTag ? 'white' : 'var(--text-secondary)',
              border: tag === currentTag ? 'none' : '1px solid var(--border-medium)',
            }}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Breadcrumb & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '20px', color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Lên thư mục cha
        </button>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ĐANG XEM</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>GIẢI TÍCH 1</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {staticFolders.length + files.length} mục
        </div>
      </div>

      {/* Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '32px' }}>
        
        {/* Mock Folders */}
        {staticFolders.map((folder, i) => (
          <div key={i} className="glass-card hover-lift" style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#F8EFEA', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                <Folder size={24} />
              </div>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1B2A4E', marginBottom: '8px' }}>{folder.name}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{folder.school}</p>
          </div>
        ))}

        {/* Real Uploaded Files */}
        {files.map(file => (
          <div key={file.id} className="glass-card hover-lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* File Preview Header (Mock) */}
            <div style={{ height: '140px', backgroundColor: '#FDF8F5', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }}>
                {file.type.toUpperCase()}
              </div>
              <FileText size={48} color="var(--border-medium)" opacity={0.5} />
            </div>
            
            <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1B2A4E', marginBottom: '8px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                <button style={{ width: '40px', height: '40px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Download size={16} />
                </button>
                <button style={{ width: '40px', height: '40px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default DocumentExplorer;
