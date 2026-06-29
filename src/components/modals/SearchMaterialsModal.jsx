import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

const SearchMaterialsModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const getEmbedUrl = (url) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com') && parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v');
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      } else if (parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.pathname.slice(1);
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }
    } catch (e) {}
    return url;
  };

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('workflow_api_key') || ''
        },
        body: JSON.stringify({ query: query.trim() })
      });
      if (!res.ok) throw new Error("Lỗi khi tìm kiếm tài liệu");
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (url) => {
    const newSet = new Set(selectedUrls);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setSelectedUrls(newSet);
  };

  const handleAddSelected = async () => {
    if (selectedUrls.size === 0) return;
    setIsAdding(true);
    try {
      const match = window.location.hash.match(/#\/project\/(\d+)/);
      const projectId = match ? parseInt(match[1]) : null;

      for (let url of Array.from(selectedUrls)) {
        await fetch('http://127.0.0.1:8000/api/documents/ingest_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, project_id: projectId })
        });
      }
      setSelectedUrls(new Set());
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="animate-fade-in" style={{
        backgroundColor: '#FCFAF8', borderRadius: '24px', 
        width: previewUrl ? '1200px' : '600px', 
        maxWidth: '95vw',
        height: '85vh',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        transition: 'width 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B2A4E', margin: 0 }}>Search learning materials</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Choose links to add, or preview them first in a new tab.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexShrink: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search material, topic, YouTube, website..." 
                style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-medium)', fontSize: '0.9rem', outline: 'none' }} 
              />
            </div>
            <button onClick={handleSearch} disabled={isLoading || !query.trim()} style={{ backgroundColor: '#5A2E3D', color: 'white', border: 'none', padding: '0 24px', borderRadius: '12px', fontWeight: 600, cursor: (isLoading || !query.trim()) ? 'not-allowed' : 'pointer', opacity: (isLoading || !query.trim()) ? 0.7 : 1 }}>
              {isLoading ? '...' : 'Search'}
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', gap: '24px', minHeight: 0 }}>
            {/* Left side: Results list */}
            <div style={{ flex: previewUrl ? '0 0 400px' : 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRadius: '16px', transition: 'all 0.3s' }}>
              {isLoading ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Đang tìm kiếm...
                </div>
              ) : error ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'red' }}>
                  {error}
                </div>
              ) : results.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {results.map((res, i) => {
                    const getScoreColor = (score) => {
                      if (!score) return 'var(--text-muted)';
                      if (score >= 80) return '#10B981'; // Green
                      if (score >= 50) return '#F59E0B'; // Yellow
                      return '#EF4444'; // Red
                    };
                    return (
                      <div key={i} 
                           onClick={() => toggleSelect(res.url)}
                           style={{ 
                             border: `2px solid ${selectedUrls.has(res.url) ? 'var(--brand-primary)' : 'transparent'}`, 
                             borderRadius: '12px', padding: '16px', 
                             backgroundColor: selectedUrls.has(res.url) ? '#FDF8F5' : 'white',
                             boxShadow: 'var(--shadow-sm)',
                             cursor: 'pointer',
                             transition: 'all 0.2s',
                             display: 'flex',
                             flexDirection: 'column'
                           }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' }}>
                          <a href={res.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--brand-primary)', textDecoration: 'none', flex: 1 }}>
                            {res.title}
                          </a>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {res.relevancy_score && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getScoreColor(res.relevancy_score), backgroundColor: `${getScoreColor(res.relevancy_score)}15`, padding: '4px 8px', borderRadius: '8px' }}>
                                {res.relevancy_score}% Match
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: '#E6F0EC', padding: '4px 8px', borderRadius: '8px' }}>
                              {res.type}
                            </span>
                          </div>
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          {res.snippet}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPreviewUrl(previewUrl === res.url ? null : res.url); }}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: previewUrl === res.url ? 'var(--brand-primary)' : 'transparent', color: previewUrl === res.url ? 'white' : 'var(--brand-primary)', border: `1px solid var(--brand-primary)`, borderRadius: '16px', cursor: 'pointer', fontWeight: 600 }}>
                            {previewUrl === res.url ? 'Close Preview' : 'Preview Web'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : hasSearched ? (
                <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', backgroundColor: 'white', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Không tìm thấy kết quả nào đủ chất lượng. Vui lòng thử từ khóa khác.
                </div>
              ) : (
                <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', backgroundColor: 'white', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Nhập từ khóa rồi bấm Search để lấy tài liệu thật từ API.
                </div>
              )}
            </div>

            {/* Right side: iframe preview */}
            {previewUrl && (
              <div style={{ flex: 1, border: '1px solid var(--border-medium)', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#F9F9F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                    Previewing: <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>{previewUrl}</a>
                  </div>
                  <button onClick={() => setPreviewUrl(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Close preview">
                    <X size={16} />
                  </button>
                </div>
                <iframe 
                  src={getEmbedUrl(previewUrl)} 
                  style={{ width: '100%', height: '100%', border: 'none' }} 
                  title="Web Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0, borderTop: '1px solid var(--border-light)' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', backgroundColor: 'white', border: '1px solid var(--border-medium)', borderRadius: '20px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button 
            onClick={handleAddSelected}
            disabled={selectedUrls.size === 0 || isAdding}
            style={{ 
              padding: '10px 24px', 
              backgroundColor: '#B890A3', 
              border: 'none', 
              borderRadius: '20px', 
              fontWeight: 600, 
              color: 'white', 
              cursor: (selectedUrls.size === 0 || isAdding) ? 'not-allowed' : 'pointer',
              opacity: (selectedUrls.size === 0 || isAdding) ? 0.7 : 1
            }}>
            {isAdding ? 'Adding...' : `Add selected (${selectedUrls.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchMaterialsModal;
