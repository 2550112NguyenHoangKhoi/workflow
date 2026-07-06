import React, { useState, useEffect } from 'react';
import { X, Loader2, Eye, Pencil } from 'lucide-react';
import { getStoredUser } from '../../utils/googleAuth';

const ProjectCollaborationModal = ({ isOpen, onClose, projectId, documentId }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor'); // Default to editor based on mockup
  const [isInviting, setIsInviting] = useState(false);
  const [activeMembers, setActiveMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = getStoredUser();

  const fetchMembers = async () => {
    if (!projectId && !documentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = projectId 
        ? `http://127.0.0.1:8000/api/projects/${projectId}/members`
        : `http://127.0.0.1:8000/api/documents/${documentId}/members`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActiveMembers(data.active || []);
        setPendingInvites(data.pending || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setEmail('');
      setError('');
    }
  }, [isOpen, projectId, documentId]);

  const handleInvite = async () => {
    if (!email.trim() || (!projectId && !documentId)) return;
    setIsInviting(true);
    setError('');
    try {
      const url = projectId 
        ? `http://127.0.0.1:8000/api/projects/${projectId}/invite`
        : `http://127.0.0.1:8000/api/documents/${documentId}/invite`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: role.toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Failed to invite user');
      } else if (data.status === 'Already invited') {
        setError('Người dùng này đã được mời.');
      } else {
        setEmail('');
        fetchMembers(); // Refresh lists
      }
    } catch (err) {
      setError('Đã xảy ra lỗi.');
    } finally {
      setIsInviting(false);
    }
  };

  if (!isOpen) return null;

  const combinedMembers = [
    ...activeMembers,
    ...pendingInvites.map(i => ({ ...i, isPending: true }))
  ];

  // Colors for avatars
  const avatarColors = [
    { bg: '#22C55E', text: '#FFFFFF' }, // Green
    { bg: '#8B5CF6', text: '#FFFFFF' }, // Purple
    { bg: '#F87171', text: '#FFFFFF' }, // Red/Pink
    { bg: '#3B82F6', text: '#FFFFFF' }, // Blue
    { bg: '#F59E0B', text: '#FFFFFF' }, // Yellow
  ];

  const getInitials = (emailOrName) => {
    if (!emailOrName) return '??';
    const parts = emailOrName.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return emailOrName.substring(0, 2).toUpperCase();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF', width: '460px', borderRadius: '16px',
        display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        maxHeight: '90vh', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1F2937' }}>
            Mời bạn bè
          </h2>
          <button onClick={onClose} style={{ 
            background: '#F3F4F6', border: 'none', 
            borderRadius: '50%', width: '32px', height: '32px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#6B7280' 
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div style={{ padding: '0 24px 24px 24px', overflowY: 'auto' }}>
          
          {/* Active Members */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: '12px' }}>
              THÀNH VIÊN HIỆN TẠI
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}><Loader2 size={24} className="spin" /></div>
              ) : (() => {
                const list = [...combinedMembers];
                const hasOwner = list.some(m => m.role && m.role.toLowerCase() === 'owner');
                if (!hasOwner) {
                  const ownerEmail = currentUser?.email || 'owner@local.app';
                  list.unshift({ email: ownerEmail, role: 'owner' });
                }
                return list;
              })().map((member, idx) => {
                const isPending = member.isPending;
                const displayName = currentUser?.email === member.email ? currentUser.name : member.email.split('@')[0];
                const colorIdx = idx % avatarColors.length;
                const { bg, text } = avatarColors[colorIdx];
                
                let roleLabel = 'Xem';
                let roleBg = '#EFF6FF';
                let roleColor = '#2563EB';
                
                if (member.role === 'editor' || member.role === 'owner' || member.role === 'admin') {
                  roleLabel = 'Chỉnh sửa';
                  roleBg = '#ECFDF5';
                  roleColor = '#059669';
                }

                if (isPending) {
                  roleLabel = 'Đang chờ';
                  roleBg = '#F3F4F6';
                  roleColor = '#6B7280';
                }

                return (
                  <div key={idx} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '12px 16px', borderRadius: '12px', border: '1px solid #F3F4F6',
                    backgroundColor: '#FAFAFA'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', backgroundColor: bg, 
                        color: text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.9rem'
                      }}>
                        {getInitials(displayName)}
                      </div>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                        {displayName}
                      </div>
                    </div>
                    <div style={{ 
                      padding: '4px 12px', borderRadius: '20px', backgroundColor: roleBg, 
                      color: roleColor, fontSize: '0.75rem', fontWeight: 600 
                    }}>
                      {roleLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invite Input */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: '12px' }}>
              EMAIL HOẶC TÊN NGƯỜI DÙNG
            </div>
            <input 
              type="email" 
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '0.9rem', outline: 'none' }}
              disabled={!projectId && !documentId}
            />
          </div>

          {/* Access Rights Toggles */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: '12px' }}>
              QUYỀN TRUY CẬP
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setRole('viewer')}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  border: role === 'viewer' ? '1px solid #007AFF' : '1px solid #E5E7EB',
                  backgroundColor: role === 'viewer' ? '#007AFF' : '#FFFFFF',
                  color: role === 'viewer' ? '#FFFFFF' : '#4B5563',
                  fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <Eye size={16} /> Chỉ xem
              </button>
              <button 
                onClick={() => setRole('editor')}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  border: role === 'editor' ? '1px solid #007AFF' : '1px solid #E5E7EB',
                  backgroundColor: role === 'editor' ? '#007AFF' : '#FFFFFF',
                  color: role === 'editor' ? '#FFFFFF' : '#4B5563',
                  fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <Pencil size={16} /> Chỉnh sửa
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button 
              onClick={handleInvite}
              disabled={isInviting || !email || (!projectId && !documentId)}
              style={{ 
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none', 
                backgroundColor: (!email || (!projectId && !documentId)) ? '#9CA3AF' : '#8A334C', color: 'white', 
                fontWeight: 600, fontSize: '1rem', cursor: (!email || (!projectId && !documentId)) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
              }}
            >
              {isInviting ? <Loader2 size={20} className="spin" /> : 'Gửi lời mời'}
            </button>
            {error && <div style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '12px', textAlign: 'center' }}>{error}</div>}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProjectCollaborationModal;
