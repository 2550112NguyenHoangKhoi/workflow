import React from 'react';
import { X, Search } from 'lucide-react';

const SearchMaterialsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '600px', maxWidth: '90vw',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E' }}>Search learning materials</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Choose links to add, or preview them first in a new tab.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px' }}>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Search material, topic, YouTube, website..." style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-medium)', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <button style={{ backgroundColor: '#5A2E3D', color: 'white', border: 'none', padding: '0 24px', borderRadius: '12px', fontWeight: 600 }}>Search</button>
          </div>

          <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', backgroundColor: 'white', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nhập từ khóa rồi bấm Search để lấy tài liệu thật từ API.
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button style={{ padding: '10px 24px', backgroundColor: '#B890A3', border: 'none', borderRadius: '20px', fontWeight: 600, color: 'white', cursor: 'not-allowed' }}>
            Add selected
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchMaterialsModal;
