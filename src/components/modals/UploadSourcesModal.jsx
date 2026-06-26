import React from 'react';
import { X, Upload } from 'lucide-react';

const UploadSourcesModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '500px', maxWidth: '90vw',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>Upload learning sources</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Only upload files from your computer or add links.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px' }}>
          
          <div style={{ border: '2px dashed var(--border-medium)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'white', marginBottom: '24px' }}>
            <Upload size={24} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700, color: '#1B2A4E', marginBottom: '8px' }}>Drag files here or click to choose</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF, DOCX, PNG, JPG, WebP, MP4, MP3...</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1B2A4E' }}>Links</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--brand-primary)', cursor: 'pointer' }}>+ Add link</div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Add YouTube, website or any URL" style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }} />
            <button style={{ backgroundColor: '#5A2E3D', color: 'white', border: 'none', padding: '0 24px', borderRadius: '12px', fontWeight: 600 }}>Add</button>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onClose} style={{ padding: '10px 24px', backgroundColor: '#5A2E3D', border: 'none', borderRadius: '20px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadSourcesModal;
