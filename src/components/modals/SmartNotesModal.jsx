import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SmartNotesModal = ({ isOpen, onClose }) => {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      generateNotes();
    } else {
      setMarkdown('');
      setError(null);
    }
  }, [isOpen]);

  const generateNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch latest doc
      const docsRes = await fetch('http://127.0.0.1:8000/api/documents');
      if (!docsRes.ok) throw new Error("Lỗi kết nối server");
      const docsData = await docsRes.json();
      
      if (!docsData.documents || docsData.documents.length === 0) {
        throw new Error("Chưa có tài liệu nào được tải lên.");
      }
      
      const latestDoc = docsData.documents[docsData.documents.length - 1];
      setActiveDoc(latestDoc);
      
      // 2. Generate Notes
      const res = await fetch('http://127.0.0.1:8000/api/generate_notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_or_text: latestDoc.content })
      });
      
      if (!res.ok) throw new Error("Failed to generate notes");
      
      const data = await res.json();
      
      // Build markdown string
      let md = `# ${data.title}\n\n`;
      md += `**Summary:** ${data.summary}\n\n`;
      
      if (data.sections) {
        data.sections.forEach(sec => {
          md += `## ${sec.heading}\n`;
          sec.bullet_points.forEach(bp => {
            md += `- ${bp}\n`;
          });
          md += `\n`;
        });
      }
      
      setMarkdown(md);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToMD = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SmartNotes_${activeDoc?.filename || 'Export'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(27, 42, 78, 0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FAFAFA', borderRadius: '24px', width: '90%', maxWidth: '800px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#1B2A4E', padding: '10px', borderRadius: '12px' }}>
              <FileText color="white" size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>Smart Notes</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                {activeDoc ? `Algorithmically Extracted from ${activeDoc.filename}` : 'TextRank Extraction'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {markdown && (
              <button onClick={exportToMD} title="Download Markdown" style={{ background: '#E8F5E9', border: 'none', cursor: 'pointer', color: '#065F46', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.875rem' }}>
                <Download size={16} /> Export MD
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--brand-primary)' }}>
              <Loader2 size={48} className="animate-spin" style={{ marginBottom: '16px' }} />
              <div style={{ fontWeight: 600 }}>Running TextRank extraction...</div>
            </div>
          ) : error ? (
            <div style={{ color: 'red', textAlign: 'center', fontWeight: 600 }}>{error}</div>
          ) : (
            <div style={{ 
              backgroundColor: 'white', padding: '32px', borderRadius: '16px', 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-light)',
              color: '#333', lineHeight: '1.6'
            }}>
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartNotesModal;
