import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, MessageCircle, Folder, Settings, Zap, FileText, User, LogOut, ChevronRight, ChevronDown, PenTool, Brain, BookMarked, Pencil, Trash2, Cloud, HardDrive, Users, Pin, X } from 'lucide-react';
import * as drive from '../../utils/googleDrive';
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

  const api = async (url, method, body) => {
    const res = await fetch(`http://127.0.0.1:8000${url}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const handleRenameFolder = async (folder) => {
    const name = window.prompt('Đổi tên thư mục:', folder.name);
    if (!name || name.trim() === folder.name) return;
    try { await api(`/api/folders/${folder.id}`, 'PATCH', { name }); fetchData(); }
    catch (e) { alert(e.message); }
  };

  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`Xoá thư mục "${folder.name}"?\nCác dự án bên trong sẽ được giữ lại và chuyển sang "Không phân loại".`)) return;
    try { await api(`/api/folders/${folder.id}`, 'DELETE'); fetchData(); }
    catch (e) { alert(e.message); }
  };

  // Right-click a project: rename, move to another folder, or delete it.
  const handleProjectMenu = async (e, project) => {
    e.preventDefault();
    const choice = window.prompt(
      `Dự án "${project.name}" — nhập số:\n1. Đổi tên\n2. Chuyển sang thư mục khác\n3. Xoá dự án`, '1');
    try {
      if (choice === '1') {
        const name = window.prompt('Tên mới:', project.name);
        if (name && name.trim() !== project.name) await api(`/api/projects/${project.id}`, 'PATCH', { name });
      } else if (choice === '2') {
        const list = folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
        const pick = window.prompt(`Chuyển tới thư mục (0 = Không phân loại):\n${list}`, '0');
        if (pick === null) return;
        const idx = parseInt(pick, 10);
        if (idx === 0) await api(`/api/projects/${project.id}`, 'PATCH', { unfile: true });
        else if (folders[idx - 1]) await api(`/api/projects/${project.id}`, 'PATCH', { folder_id: folders[idx - 1].id });
        else return;
      } else if (choice === '3') {
        if (!window.confirm(`Xoá dự án "${project.name}" cùng toàn bộ tài liệu, flashcard và đề thi bên trong? Không thể hoàn tác.`)) return;
        await api(`/api/projects/${project.id}`, 'DELETE');
        if (routeProjectId === String(project.id)) navigate('/documents');
      } else {
        return;
      }
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // --- Google Drive tree: the signed-in user's own Drive (lazy-loaded) + pinned folders ---
  const activeDriveFolder = new URLSearchParams(location.search).get('folder');
  const [driveConnected, setDriveConnected] = useState(drive.isConnected());
  const [sharedDrives, setSharedDrives] = useState([]);
  const [pinned, setPinned] = useState(drive.getPinnedFolders());
  const [driveTree, setDriveTree] = useState({});      // parentId -> subfolders | {error}
  const [driveExpanded, setDriveExpanded] = useState({});
  const [driveBusy, setDriveBusy] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDriveConnected(drive.isConnected());
      setPinned(drive.getPinnedFolders());
      setDriveTree({});
    };
    window.addEventListener(drive.AUTH_EVENT, sync);
    drive.restoreSession().then(sync);
    return () => window.removeEventListener(drive.AUTH_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!driveConnected) { setSharedDrives([]); return; }
    drive.listSharedDrives().then(setSharedDrives).catch(() => setSharedDrives([]));
  }, [driveConnected]);

  const handleConnectDrive = async () => {
    if (!drive.isConfigured()) { navigate('/settings'); return; }
    setDriveBusy(true);
    try {
      await drive.connectDrive();
      setDriveExpanded({ [drive.MY_DRIVE]: true });
      navigate(`/documents?folder=${drive.MY_DRIVE}`);
    } catch (err) {
      alert(err.message || String(err));
    }
    setDriveBusy(false);
  };

  const toggleDriveNode = (id) => setDriveExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Load the subfolders of every expanded node that has none yet (also after sign-in, when
  // the tree cache is cleared but nodes stay expanded).
  const loadingNodes = React.useRef(new Set());
  useEffect(() => {
    Object.keys(driveExpanded).forEach(async (id) => {
      if (!driveExpanded[id] || driveTree[id] !== undefined || loadingNodes.current.has(id)) return;
      loadingNodes.current.add(id);
      try {
        const { folders: subs } = await drive.listChildren(id);
        setDriveTree(prev => ({ ...prev, [id]: subs }));
      } catch (err) {
        setDriveTree(prev => ({ ...prev, [id]: { error: err.message || String(err) } }));
      } finally {
        loadingNodes.current.delete(id);
      }
    });
  }, [driveExpanded, driveTree]);

  const DriveNode = ({ id, name, depth, icon: Icon = Folder, onRemove }) => {
    const isActive = activeDriveFolder === id;
    const isOpen = driveExpanded[id];
    const children = driveTree[id];
    return (
      <div>
        <div title={name} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px', paddingLeft: `${8 + depth * 14}px`,
          borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
          color: isActive ? 'var(--brand-secondary)' : 'var(--text-secondary)',
          backgroundColor: isActive ? 'var(--accent-green)' : 'transparent'
        }}>
          <span onClick={(e) => { e.stopPropagation(); toggleDriveNode(id); }} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span onClick={() => navigate(`/documents?folder=${id}`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            <Icon size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          </span>
          {onRemove && (
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Bỏ ghim"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={12} />
            </button>
          )}
        </div>
        {isOpen && children === undefined && (
          <div style={{ paddingLeft: `${30 + depth * 14}px`, fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 0' }}>Đang tải…</div>
        )}
        {isOpen && children?.error && (
          <div style={{ paddingLeft: `${30 + depth * 14}px`, fontSize: '0.72rem', color: 'var(--danger, #B91C1C)', padding: '4px 8px 4px 30px' }}>{children.error}</div>
        )}
        {isOpen && Array.isArray(children) && children.length === 0 && (
          <div style={{ paddingLeft: `${30 + depth * 14}px`, fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 0' }}>Không có thư mục con</div>
        )}
        {isOpen && Array.isArray(children) && children.map(sub => (
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
          {/* Google Drive: the user's own folders */}
          <div style={{ padding: '0 24px', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>GOOGLE DRIVE</h3>
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', marginBottom: '20px', padding: '0 12px', maxHeight: '260px', overflowY: 'auto' }}>
            {driveConnected ? (
              <>
                <DriveNode id={drive.MY_DRIVE} name="Drive của tôi" depth={0} icon={HardDrive} />
                <DriveNode id={drive.SHARED_WITH_ME} name="Được chia sẻ với tôi" depth={0} icon={Users} />
                {sharedDrives.map(d => <DriveNode key={d.id} id={d.id} name={d.name} depth={0} icon={HardDrive} />)}
              </>
            ) : (
              <button onClick={handleConnectDrive} disabled={driveBusy}
                title={drive.isConfigured() ? 'Đăng nhập Google để xem các thư mục Drive của bạn' : 'Cần nhập OAuth Client ID trong Cài đặt'}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', margin: '0 4px 6px', borderRadius: '10px', border: '1px dashed var(--brand-primary)', background: 'transparent', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: driveBusy ? 0.6 : 1 }}>
                <Cloud size={15} /> {driveBusy ? 'Đang chờ Google…' : 'Kết nối Google Drive'}
              </button>
            )}
            {pinned.map(f => (
              <DriveNode key={f.id} id={f.id} name={f.name} depth={0} icon={Pin} onRemove={() => drive.unpinFolder(f.id)} />
            ))}
          </div>

          {/* Drive Folders */}
      <div style={{ padding: '0 24px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>THƯ MỤC DỰ ÁN</h3>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }} title="Đổi tên thư mục"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} title="Xoá thư mục (giữ lại dự án)"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNewProject(folder.id); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    title="Thêm dự án vào thư mục"
                  >
                    <span style={{ fontSize: '1.2rem', fontWeight: 500 }}>+</span>
                  </button>
                </div>
              </div>
              
              {isExpanded && folderProjects.length > 0 && (
                <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                  {folderProjects.map(project => {
                    const isActive = isChatView && routeProjectId === String(project.id);
                    return (
                      <div 
                        key={project.id} 
                        onClick={() => navigate(`/project/${project.id}`)}
                onContextMenu={(e) => handleProjectMenu(e, project)}
                title="Chuột phải: đổi tên / chuyển thư mục / xoá"
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
                onContextMenu={(e) => handleProjectMenu(e, project)}
                title="Chuột phải: đổi tên / chuyển thư mục / xoá"
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
                onContextMenu={(e) => handleProjectMenu(e, project)}
                title="Chuột phải: đổi tên / chuyển thư mục / xoá"
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
            m.signOutGoogle().finally(() => window.location.reload());
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
