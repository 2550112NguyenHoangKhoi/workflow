import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FolderOpen, MessageCircle, Folder, Settings, Zap, FileText } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const isDocumentView = location.pathname.startsWith('/document/');

  const folders = [
    { name: 'GỐC / ĐẠI HỌC BÁCH KHOA HÀ NỘI (HUST) / GIẢI TÍCH 1', active: true },
    { name: 'Thư mục gốc', icon: true },
    { name: 'ĐẠI HỌC BÁCH KHOA ...', icon: true },
    { name: 'ĐẠI SỐ TUYẾN TÍNH', icon: true },
    { name: 'GIẢI TÍCH 1', icon: true, activeBg: true, children: [
      'Đề cuối kỳ',
      'Đề cương Giải tích 1',
      'Giáo trình - Bài giảng',
      'Lý thuyết và giải đề',
      'Tóm tắt công thức'
    ]},
    { name: 'VẬT LÝ ĐẠI CƯƠNG 1', icon: true },
    { name: 'VẬT LÝ ĐẠI CƯƠNG 2', icon: true },
    { name: 'ĐẠI HỌC KINH TẾ QUỐC ...', icon: true },
    { name: 'ĐẠI HỌC KINH TẾ TP.HCM', icon: true },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      zIndex: 10,
      overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px', marginBottom: '24px' }}>
        <h1 style={{ 
          fontFamily: 'Georgia, serif', 
          fontSize: '1.5rem', 
          fontWeight: 900, 
          color: 'var(--brand-primary)',
          letterSpacing: '-0.01em',
          fontStyle: 'italic'
        }}>
          Workflow
        </h1>
      </div>

      {/* Main Nav */}
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: isDocumentView ? '8px' : '24px' }}>
        <NavLink to="/chat" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: isActive && !isDocumentView ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: isActive && !isDocumentView ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <MessageCircle size={20} />
          <span>Chat</span>
        </NavLink>

        <NavLink to="/documents" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: (isActive && !isDocumentView) ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: (isActive && !isDocumentView) ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <FolderOpen size={20} />
          <div>
            <div>Hub tài liệu</div>
          </div>
        </NavLink>
      </div>

      {/* Active Project Context (Only in Document View) */}
      {isDocumentView && (
        <div style={{ padding: '12px 16px', backgroundColor: '#F3EAE3', margin: '0 12px 24px', borderRadius: '12px' }}>
          <div style={{ fontWeight: 700, color: '#1B2A4E', fontSize: '0.9rem', marginBottom: '4px' }}>CK_HK233 (1)</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ngày 26 tháng 6, 2026</div>
        </div>
      )}

      {/* Drive Folders */}
      <div style={{ padding: '0 24px', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>THƯ MỤC DRIVE</h3>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {folders.map((folder, idx) => (
          <div key={idx} style={{ padding: '0 12px' }}>
            {folder.active ? (
              <div style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: '#F3EAE3', borderLeft: '3px solid var(--border-medium)', marginBottom: '8px' }}>
                {folder.name}
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', 
                borderRadius: '8px', color: folder.activeBg ? 'var(--brand-secondary)' : 'var(--text-secondary)',
                backgroundColor: folder.activeBg ? '#E6F0EC' : 'transparent',
                fontWeight: folder.activeBg ? 600 : 500, fontSize: '0.875rem', cursor: 'pointer'
              }}>
                {folder.icon && <Folder size={16} />}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
              </div>
            )}
            
            {folder.children && (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px', marginBottom: '8px' }}>
                {folder.children.map((child, cidx) => (
                  <div key={cidx} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px 8px 44px',
                    color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer'
                  }}>
                    <Folder size={16} color="var(--text-muted)" />
                    <span>{child}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)', marginTop: 'auto' }}>
        <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-10px', left: '-10px', backgroundColor: '#FEF3C7', color: '#D97706', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} />
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>AI TOKENS</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>500.0k còn lại</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã dùng 0 (0.00%)</div>
          <div style={{ height: '4px', backgroundColor: 'var(--border-light)', borderRadius: '2px', marginTop: '8px' }}>
            <div style={{ width: '0%', height: '100%', backgroundColor: 'var(--brand-primary)', borderRadius: '2px' }}></div>
          </div>
        </div>

        <NavLink to="/settings" style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginTop: '16px', borderRadius: '12px',
          color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none'
        }}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
