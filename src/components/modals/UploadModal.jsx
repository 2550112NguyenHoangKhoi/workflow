import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';

const UploadModal = ({ isOpen, onClose, onUpload, projectId, documentId }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [school, setSchool] = useState('ĐHBK-HCM');
  const [department, setDepartment] = useState('Khoa học máy tính');
  const [subject, setSubject] = useState('Khác');
  const [customSubject, setCustomSubject] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [docType, setDocType] = useState('Chọn loại');
  const [academicYear, setAcademicYear] = useState('Chọn năm học');
  const [teacher, setTeacher] = useState('');
  const [adminNote, setAdminNote] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('school', school);
      formData.append('department', department);
      formData.append('subject', subject === 'Khác' ? customSubject : subject);
      formData.append('subject_code', subjectCode);
      formData.append('doc_type', docType);
      formData.append('academic_year', academicYear);
      formData.append('teacher', teacher);
      formData.append('notes', adminNote);
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
        onUpload();
      } else {
        alert("Upload failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', width: '600px', maxWidth: '90vw',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', letterSpacing: '0.05em', marginBottom: '4px' }}>ĐÓNG GÓP TÀI LIỆU</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-navy)' }}>Thông tin phân loại tài liệu</h2>
            {file && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>1 file - {(file.size / 1024).toFixed(1)} KB</div>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* File input / Selection */}
          <div style={{ border: '1px solid #E6D0C1', backgroundColor: '#FDF8F5', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>FILE ĐÃ CHỌN</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>1 file</span>
            </div>
            {file ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{file.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ) : (
              <input type="file" accept=".txt,.md,.pdf" onChange={handleFileChange} style={{ width: '100%', padding: '12px' }} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>TRƯỜNG *</label>
              <select 
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.9rem' }}
              >
                <option>ĐHBK-HCM</option>
                <option>HCMUS</option>
                <option>TDTU</option>
                <option>FTU</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>NGÀNH *</label>
              <select 
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.9rem' }}
              >
                <option>Khoa học máy tính</option>
                <option>Kỹ thuật phần mềm</option>
                <option>Hệ thống thông tin</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>MÔN HỌC *</label>
              <select 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.9rem', marginBottom: '8px' }}
              >
                <option>Khác</option>
                <option>Cơ sở dữ liệu</option>
                <option>Mạng máy tính</option>
                <option>Cấu trúc dữ liệu và giải thuật</option>
              </select>
              {subject === 'Khác' && (
                <input 
                  type="text" 
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Nhập tên môn học" 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }} 
                />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>MÃ MÔN</label>
              <input 
                type="text" 
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="VD: CSC10004" 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>LOẠI TÀI LIỆU</label>
              <select 
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.9rem' }}
              >
                <option>Chọn loại</option>
                <option>Slide / bài giảng</option>
                <option>Đề thi</option>
                <option>Lời giải</option>
                <option>Báo cáo / đồ án</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>NĂM HỌC / HỌC KỲ</label>
              <select 
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.9rem' }}
              >
                <option>Chọn năm học</option>
                <option>2025-2026</option>
                <option>2024-2025</option>
                <option>2023-2024</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>GIẢNG VIÊN</label>
            <input 
              type="text" 
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="Nếu có" 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>GHI CHÚ CHO ADMIN</label>
            <textarea 
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Nguồn tài liệu, nội dung chính, lưu ý khi phân loại..." 
              rows={4} 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem', resize: 'none' }}
            ></textarea>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          <button onClick={onClose} style={{ padding: '12px 24px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={isUploading || !file} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: file ? '#1B2A4E' : '#E2E8F0', color: file ? 'white' : '#64748B', fontWeight: 700, border: 'none', cursor: file ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Upload size={18} /> Upload
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
