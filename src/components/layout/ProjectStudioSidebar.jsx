import React, { useState } from 'react';
import { Check, MoreVertical, Search, Upload, Calendar, MessageCircle, AlertCircle } from 'lucide-react';
import UploadSourcesModal from '../modals/UploadSourcesModal';
import SearchMaterialsModal from '../modals/SearchMaterialsModal';

const ProjectStudioSidebar = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState('OmiGuide');

  return (
    <>
    <aside style={{
      width: '360px',
      height: '100%',
      backgroundColor: 'var(--bg-tertiary)',
      borderLeft: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Header Actions */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)' }}>
        <button onClick={() => setIsUploadOpen(true)} style={{ flex: 1, backgroundColor: '#FDF8F5', color: '#1B2A4E', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Upload size={16} /> <span style={{ fontSize: '0.85rem' }}>Upload</span>
        </button>
        <button style={{ flex: 1, backgroundColor: '#FDF8F5', color: '#1B2A4E', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Calendar size={16} /> <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Study...</span>
        </button>
        <button onClick={() => setIsSearchOpen(true)} style={{ flex: 1, backgroundColor: '#FDF8F5', color: '#1B2A4E', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Search size={16} /> <span style={{ fontSize: '0.85rem' }}>Search</span>
        </button>
      </div>

      <div style={{ padding: '24px' }}>
        
        {/* Personas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {['Gia sư thân thiện', 'Coach nghiêm túc', 'Socratic hỏi gợi mở', 'Bạn học Gen Z'].map(persona => (
            <button key={persona} onClick={() => setSelectedPersona(persona)} style={{
              padding: '10px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
              backgroundColor: selectedPersona === persona ? 'var(--brand-primary)' : 'white',
              color: selectedPersona === persona ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${selectedPersona === persona ? 'var(--brand-primary)' : 'var(--border-medium)'}`
            }}>
              {persona}
            </button>
          ))}
        </div>
        
        <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '12px', marginBottom: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
          OmiGuide
        </div>
        
        <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Thân thiện, kiên nhẫn, nói như gia sư 1-1, ưu tiên ví dụ dễ hiểu.
        </div>
        
        <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Giải thích ngắn trước, hỏi lại 1 câu để kiểm tra hiểu, không phán xét khi học sinh sai.
        </div>
        
        <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', marginBottom: '32px', fontSize: '0.875rem', fontWeight: 600, color: '#1B2A4E' }}>
          Muốn học nhẹ nhàng, có ví dụ đời thườn
        </div>

        {/* Giáo Án (Roadmap) */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>GIÁO ÁN</h3>
            <MoreVertical size={16} color="var(--text-muted)" />
          </div>
          
          <div style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '16px', backgroundColor: 'white', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <span style={{ border: '1px solid var(--border-medium)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Lỗi</span>
              <span style={{ backgroundColor: '#F3EAE3', borderRadius: '20px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)' }}>Tài liệu project</span>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Không thể hoàn tất giáo án từ roadmap.
            </p>

            <div style={{ backgroundColor: '#FDF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px' }}>
              Roadmap đang được tạo. Hãy đợi hoàn tất rồi tạo Study Plan.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--success-bg)', border: '1px solid #A7F3D0', borderRadius: '12px', color: 'var(--brand-secondary)', fontWeight: 700, fontSize: '0.875rem' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} />
                </div>
                Kiểm tra tài liệu trong project
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#FDF8F5', border: '1px solid #FCA5A5', borderRadius: '12px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.875rem' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                  2
                </div>
                Tạo roadmap từ tài liệu
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '12px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>
                <div style={{ borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                  3
                </div>
                Chuyển roadmap thành giáo án
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ flex: 1, backgroundColor: '#B890A3', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'not-allowed' }}>
                Tạo giáo án
              </button>
              <button style={{ flex: 1, backgroundColor: 'white', color: '#B890A3', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', fontWeight: 700 }}>
                Dùng LLM
              </button>
            </div>
          </div>
        </div>

        {/* Uploaded */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>UPLOADED</h3>
            <MoreVertical size={16} color="var(--text-muted)" />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <Check size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                CK_HK233 (1).pdf <span style={{ color: 'var(--text-muted)' }}>↗</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Sẵn sàng để hỏi</div>
            </div>
          </div>
        </div>
        
      </div>
    </aside>

    <UploadSourcesModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    <SearchMaterialsModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default ProjectStudioSidebar;
