import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, Mail, Loader2, ChevronDown } from 'lucide-react';
import { getStoredUser } from '../../utils/googleAuth';

const ProjectCollaborationModal = ({ isOpen, onClose, projectId, documentId }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Viewer');
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

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#FFFDF9', width: '560px', borderRadius: '24px',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
        maxHeight: '85vh', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 32px 16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
              PROJECT COLLABORATION
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1B2A4E' }}>
              Members and invites
            </h2>
          </div>
          <button onClick={onClose} style={{ 
            background: 'white', border: '1px solid var(--border-light)', 
            borderRadius: '50%', width: '32px', height: '32px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)' 
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div style={{ padding: '16px 32px 32px 32px', overflowY: 'auto' }}>
          
          {/* Invite Section */}
          <div style={{ 
            border: '1px solid #E5E7EB', borderRadius: '16px', padding: '20px', 
            backgroundColor: 'white', marginBottom: '24px' 
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', letterSpacing: '0.05em', marginBottom: '12px' }}>
              INVITE BY EMAIL
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="email" 
                placeholder="teammate@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '0.875rem', outline: 'none' }}
                disabled={!projectId && !documentId}
              />
              <div style={{ position: 'relative', minWidth: '100px' }}>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 32px 10px 16px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '0.875rem', outline: 'none', appearance: 'none', backgroundColor: 'white', cursor: (!projectId && !documentId) ? 'not-allowed' : 'pointer', fontWeight: 600, color: '#374151' }}
                  disabled={!projectId && !documentId}
                >
                  <option value="Viewer">Viewer</option>
                  <option value="Editor">Editor</option>
                  <option value="Admin">Admin</option>
                </select>
                <ChevronDown size={14} color="#6B7280" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              <button 
                onClick={handleInvite}
                disabled={isInviting || !email || (!projectId && !documentId)}
                style={{ 
                  padding: '0 20px', borderRadius: '12px', border: 'none', 
                  backgroundColor: (!email || (!projectId && !documentId)) ? '#D1D5DB' : 'var(--brand-primary)', color: 'white', 
                  fontWeight: 600, fontSize: '0.875rem', cursor: (!email || (!projectId && !documentId)) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                }}
              >
                {isInviting ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                Invite
              </button>
            </div>
            {error && <div style={{ color: '#B91C1C', fontSize: '0.85rem', marginTop: '8px' }}>{error}</div>}
          </div>

          {/* Active Members */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', letterSpacing: '0.05em', marginBottom: '12px' }}>
              ACTIVE MEMBERS
            </div>
            
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '16px', backgroundColor: 'white', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={24} className="spin" /></div>
              ) : (() => {
                const list = [...activeMembers];
                const hasOwner = list.some(m => m.role && m.role.toLowerCase() === 'owner');
                if (!hasOwner) {
                  const ownerEmail = currentUser?.email || 'owner@local.app';
                  list.unshift({ email: ownerEmail, role: 'owner' });
                }
                return list;
              })().map((member, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '16px', borderBottom: idx < activeMembers.length - 1 ? '1px solid #E5E7EB' : 'none' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F3E8E8', 
                      color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1.1rem'
                    }}>
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      {currentUser?.email === member.email ? (
                        <div style={{ fontWeight: 700, color: '#1B2A4E', fontSize: '0.95rem' }}>{currentUser.name}</div>
                      ) : (
                        <div style={{ fontWeight: 700, color: '#1B2A4E', fontSize: '0.95rem' }}>{member.email.split('@')[0]}</div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{member.email}</div>
                    </div>
                  </div>
                  <div style={{ 
                    padding: '4px 12px', borderRadius: '16px', backgroundColor: '#FDECEC', 
                    color: 'var(--brand-primary)', fontSize: '0.75rem', fontWeight: 700 
                  }}>
                    {member.role}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invites */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', letterSpacing: '0.05em', marginBottom: '12px' }}>
              PENDING INVITES
            </div>
            
            <div style={{ border: '1px dashed #D1D5DB', borderRadius: '16px', backgroundColor: 'white', padding: pendingInvites.length === 0 ? '24px' : '0', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={24} className="spin" /></div>
              ) : pendingInvites.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                  No invites yet.
                </div>
              ) : pendingInvites.map((invite, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '16px', borderBottom: idx < pendingInvites.length - 1 ? '1px solid #E5E7EB' : 'none' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F3F4F6', 
                      color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1.1rem'
                    }}>
                      <Mail size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>{invite.email}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Invited as {invite.role}</div>
                    </div>
                  </div>
                  <div style={{ 
                    padding: '4px 12px', borderRadius: '16px', backgroundColor: '#F3F4F6', 
                    color: '#4B5563', fontSize: '0.75rem', fontWeight: 600 
                  }}>
                    {invite.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProjectCollaborationModal;
