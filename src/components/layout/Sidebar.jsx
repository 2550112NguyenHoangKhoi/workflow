import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, MessageCircle, Folder, Settings, Zap, FileText, User, LogOut, ChevronRight, ChevronDown, PenTool, Brain, BookMarked } from 'lucide-react';
import { LIBRARY_ROOT, LIBRARY_ROOT_NAME, listChildren } from '../../utils/googleDrive';
import UserProfileModal from '../modals/UserProfileModal';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const match = location.pathname.match(/^\/(project|document)\/([^/]+)/);
  const routeProjectId = match && match[1] === 'project' ? match[2] : null;
  const isChatView = location.pathname.startsWith('/project/') || location.pathname === '/chat';
  const isDocumentView = !isChatView; // default to doc view for settings etc.
  const [folders, setFolders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [usage, setUsage] = useState(null);

  const fmtK = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const fetchData = async () => {
    try {
      const [fRes, pRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/folders'),
        fetch('http://127.0.0.1:8000/api/projects')
      ]);
      if (fRes.ok) setFolders(await fRes.json());
      if (pRes.ok) {
        const data = await pRes.json();
        setProjects(Array.isArray(data) ? data : data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetch('http://127.0.0.1:8000/api/usage')
      .then(res => res.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  const handleNewProject = async (folderId = null) => {
    const name = window.prompt("Tên dự án mới:");
    if (!name) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: "", folder_id: folderId })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create project', err);
    }
  };

  const handleNewFolder = async () => {
    const name = window.prompt("Tên thư mục mới:");
    if (!name) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Failed to create folder', err);
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // --- Public Drive library tree (lazy-loaded, mirrors the reference product's sidebar) ---
  const activeDriveFolder = new URLSearchParams(location.search).get('folder');
  const [driveTree, setDriveTree] = useState({});      // parentId -> subfolders
  const [driveExpanded, setDriveExpanded] = useState({ [LIBRARY_ROOT]: false });

  const toggleDriveNode = async (id) => {
    const opening = !driveExpanded[id];
    setDriveExpanded(prev => ({ ...prev, [id]: opening }));
    if (opening && !driveTree[id]) {
      try {
        const { folders: subs } = await listChildren(id);
        setDriveTree(prev => ({ ...prev, [id]: subs }));
      } catch {
        setDriveTree(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const DriveNode = ({ id, name, depth }) => {
    const isActive = activeDriveFolder === id;
    const isOpen = driveExpanded[id];
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px', paddingLeft: `${8 + depth * 14}px`,
          borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
          color: isActive ? 'var(--brand-secondary)' : 'var(--text-secondary)',
          backgroundColor: isActive ? 'var(--accent-green)' : 'transparent'
        }}>
          <span onClick={(e) => { e.stopPropagation(); toggleDriveNode(id); }} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span onClick={() => navigate(`/documents?folder=${id}`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            <Folder size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>{name}</span>
          </span>
        </div>
        {isOpen && (driveTree[id] || []).map(sub => (
          <DriveNode key={sub.id} id={sub.id} name={sub.name} depth={depth + 1} />
        ))}
      </div>
    );
  };



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


      {/* Main Nav */}
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: isDocumentView ? '8px' : '24px' }}>
        <NavLink to="/chat" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: isActive || isChatView ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: isActive || isChatView ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <MessageCircle size={20} />
          <span>Chat</span>
        </NavLink>

        <NavLink to="/documents" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: (isActive || (!isChatView && location.pathname === '/documents')) ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: (isActive || (!isChatView && location.pathname === '/documents')) ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <FolderOpen size={20} />
          <div>
            <div>Hub tài liệu</div>
          </div>
        </NavLink>

        <NavLink to="/writing" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: (isActive || location.pathname === '/writing') ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: (isActive || location.pathname === '/writing') ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <PenTool size={20} />
          <div>
            <div>Luyện viết</div>
          </div>
        </NavLink>

        <NavLink to="/active-learning" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: (isActive || location.pathname === '/active-learning') ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: (isActive || location.pathname === '/active-learning') ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <Brain size={20} />
          <div>
            <div>Học chủ động</div>
          </div>
        </NavLink>

        <NavLink to="/vocabulary" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: (isActive || location.pathname === '/vocabulary') ? 'var(--bg-tertiary)' : 'var(--text-primary)',
          backgroundColor: (isActive || location.pathname === '/vocabulary') ? 'var(--brand-primary)' : 'transparent',
          fontWeight: 600, textDecoration: 'none'
        })}>
          <BookMarked size={20} />
          <div>
            <div>Từ vựng</div>
          </div>
        </NavLink>
      </div>

      {/* Contextual Sections */}
      {isDocumentView ? (
        <>
          {/* Public Drive library tree */}
          <div style={{ padding: '0 24px', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>THƯ VIỆN DRIVE</h3>
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', marginBottom: '20px', padding: '0 12px', maxHeight: '220px', overflowY: 'auto' }}>
            <DriveNode id={LIBRARY_ROOT} name={LIBRARY_ROOT_NAME} depth={0} />
          </div>

          {/* Drive Folders */}
      <div style={{ padding: '0 24px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>THƯ MỤC DRIVE</h3>
        <button onClick={handleNewFolder} title="New Folder" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 500 }}>+</span>
        </button>
      </div>
      
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', marginBottom: '24px', padding: '0 12px' }}>
        {folders.map(folder => {
          const folderProjects = projects.filter(p => p.folder_id === folder.id);
          const isExpanded = expandedFolders[folder.id];
          return (
            <div key={folder.id} style={{ marginBottom: '8px' }}>
              <div 
                onClick={() => toggleFolder(folder.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px',
                  borderRadius: '8px', color: 'var(--text-secondary)',
                  backgroundColor: isExpanded ? 'var(--accent-warm)' : 'transparent',
                  fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  borderLeft: isExpanded ? '3px solid var(--brand-secondary)' : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FolderOpen size={16} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNewProject(folder.id); }} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  title="Thêm dự án vào thư mục"
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 500 }}>+</span>
                </button>
              </div>
              
              {isExpanded && folderProjects.length > 0 && (
                <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                  {folderProjects.map(project => {
                    const isActive = isChatView && routeProjectId === String(project.id);
                    return (
                      <div 
                        key={project.id} 
                        onClick={() => navigate(`/project/${project.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px',
                          borderRadius: '8px', color: isActive ? 'var(--brand-secondary)' : 'var(--text-secondary)', 
                          backgroundColor: isActive ? 'var(--accent-green)' : 'transparent',
                          fontWeight: isActive ? 600 : 500, fontSize: '0.875rem', cursor: 'pointer'
                        }}
                      >
                        <FileText size={14} color="var(--text-muted)" />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0 24px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PROJECTS KHÔNG PHÂN LOẠI</h3>
        <button onClick={() => handleNewProject(null)} title="New Project" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 500 }}>+</span>
        </button>
      </div>
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
        <div style={{ padding: '0 12px' }}>
          {projects.filter(p => !p.folder_id).map(project => {
            const isActive = isChatView && routeProjectId === String(project.id);
            return (
              <div 
                key={project.id} 
                onClick={() => navigate(`/project/${project.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
                  borderRadius: '8px', color: isActive ? 'var(--brand-secondary)' : 'var(--text-secondary)', 
                  backgroundColor: isActive ? 'var(--accent-green)' : 'transparent',
                  fontWeight: isActive ? 600 : 500, fontSize: '0.875rem', cursor: 'pointer'
                }}
              >
                <Folder size={16} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</span>
              </div>
            );
          })}
        </div>
      </div>
        </>
      ) : (
        <>
          {/* Project View List */}
          <div style={{ padding: '0 24px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PROJECTS CỦA BẠN</h3>
            <button onClick={() => handleNewProject(null)} title="Tạo dự án mới" style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 500, lineHeight: 1 }}>+</span>
            </button>
          </div>
          <div style={{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', marginBottom: '24px', padding: '0 12px' }}>
            {projects.map(project => {
              const isActive = isChatView && routeProjectId === String(project.id);
              return (
                <div 
                  key={project.id} 
                  onClick={() => navigate(`/project/${project.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
                    borderRadius: '8px', color: isActive ? 'var(--brand-secondary)' : 'var(--text-secondary)', 
                    backgroundColor: isActive ? 'var(--accent-green)' : 'transparent',
                    fontWeight: isActive ? 600 : 500, fontSize: '0.875rem', cursor: 'pointer'
                  }}
                >
                  <MessageCircle size={16} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bottom section */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)', marginTop: 'auto' }}>
        <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-10px', left: '-10px', backgroundColor: 'var(--accent-amber-bg)', color: 'var(--accent-amber-text)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} />
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>AI TOKENS</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{usage ? fmtK(usage.remaining) : '…'} còn lại</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã dùng {usage ? `${fmtK(usage.used)} (${usage.percent}%)` : '…'}</div>
        </div>

        <NavLink to="/settings" style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginTop: '16px', borderRadius: '12px',
          color: isActive ? 'var(--bg-tertiary)' : 'var(--text-primary)', backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent', border: 'none', cursor: 'pointer',
          width: '100%', textAlign: 'left', fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box'
        })}>
          <Settings size={20} />
          <span>Cài đặt local</span>
        </NavLink>

        <button onClick={() => setIsProfileOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginTop: '16px', borderRadius: '12px',
          color: 'var(--text-primary)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
          width: '100%', textAlign: 'left', fontWeight: 600
        }}>
          <User size={20} />
          <span>Hồ sơ của tôi</span>
        </button>

        <button onClick={() => {
          import('../../utils/googleAuth').then(m => {
            m.signOutGoogle();
            window.location.reload();
          });
        }} style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
          color: 'var(--brand-primary)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
          width: '100%', textAlign: 'left', fontWeight: 600
        }}>
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
      </div>
      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
};

export default Sidebar;
