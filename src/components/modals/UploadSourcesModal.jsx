import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Link as LinkIcon, Check } from 'lucide-react';

const UploadSourcesModal = ({ isOpen, onClose, projectId, documentId }) => {
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleUploadFile = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      if (projectId) {
        formData.append('project_id', projectId);
      }
      if (documentId) {
        formData.append('document_id', documentId);
      }
      
      const res = await fetch('http://127.0.0.1:8000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setUploadStatus('success');
        setTimeout(() => { setUploadStatus(null); }, 3000);
      } else {
        setUploadStatus('error');
      }
    } catch (e) {
      console.error(e);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleUploadFile(e.dataTransfer.files);
    }
  };

  const handleClickBox = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      handleUploadFile(e.target.files);
    }
  };

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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-navy)' }}>Upload learning sources</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Only upload files from your computer or add links.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px' }}>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          <div 
            onClick={handleClickBox}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ border: '2px dashed var(--border-medium)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-tertiary)', marginBottom: '16px' }}
          >
            {isUploading ? (
              <>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--brand-primary)' }} />
                <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: '8px' }}>Tải tài liệu lên...</div>
              </>
            ) : (
              <>
                <Upload size={24} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: '8px' }}>Drag files here or click to choose</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF, DOCX, PNG, JPG, WebP, MP4, MP3...</div>
              </>
            )}
          </div>
          {uploadStatus === 'success' && <div style={{ fontSize: '0.82rem', color: 'var(--brand-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> Tải tài liệu lên thành công!</div>}
          {uploadStatus === 'error' && <div style={{ fontSize: '0.82rem', color: 'red', marginBottom: '16px' }}>Lỗi khi xử lý tài liệu.</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-navy)' }}>Links</div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Add YouTube, website or any URL" 
                style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }} 
              />
              <button 
                onClick={async () => {
                  if (!urlInput) return;
                  setIsUploading(true);
                  setUploadStatus(null);
                  try {
                    const res = await fetch('http://127.0.0.1:8000/api/documents/url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        url: urlInput, 
                        project_id: projectId ? parseInt(projectId) : null,
                        document_id: documentId ? parseInt(documentId) : null
                      })
                    });
                    if (res.ok) {
                      setUploadStatus('success');
                      setUrlInput('');
                      setTimeout(() => { setUploadStatus(null); }, 3000);
                    } else {
                      setUploadStatus('error');
                    }
                  } catch (e) {
                    setUploadStatus('error');
                  } finally {
                    setIsUploading(false);
                  }
                }}
                disabled={isUploading}
                style={{ backgroundColor: '#5A2E3D', color: 'white', border: 'none', padding: '0 24px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: isUploading ? 0.7 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
              </button>
            </div>
            {uploadStatus === 'success' && <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> Thêm link thành công!</div>}
            {uploadStatus === 'error' && <div style={{ fontSize: '0.8rem', color: 'red' }}>Lỗi khi xử lý link.</div>}
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '20px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
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
