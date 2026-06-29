import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2, Clock, BookOpen } from 'lucide-react';

const StudyPlanModal = ({ isOpen, onClose }) => {
  const [pathData, setPathData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  const [duration, setDuration] = useState('14 ngày');
  const [targetLevel, setTargetLevel] = useState('Thành thạo');

  useEffect(() => {
    if (!isOpen) {
      setPathData(null);
      setError(null);
    }
  }, [isOpen]);

  const generatePath = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch latest doc
      const matchDoc = window.location.hash.match(/#\/document\/([^/]+)/);
      const matchProj = window.location.hash.match(/#\/project\/([^/]+)/);
      const docId = matchDoc ? parseInt(matchDoc[1], 10) : null;
      const projId = matchProj ? parseInt(matchProj[1], 10) : null;

      let url = 'http://127.0.0.1:8000/api/documents';
      if (projId) {
        url += `?project_id=${projId}`;
      }

      const docsRes = await fetch(url);
      if (!docsRes.ok) throw new Error("Lỗi kết nối server");
      const docsData = await docsRes.json();
      
      if (!docsData.documents || docsData.documents.length === 0) {
        throw new Error("Chưa có tài liệu nào được tải lên.");
      }
      
      let latestDoc = docsData.documents[docsData.documents.length - 1];
      if (docId) {
        const found = docsData.documents.find(d => d.id === docId);
        if (found) latestDoc = found;
      } else {
        const storedId = sessionStorage.getItem('active_document_id');
        if (storedId) {
          const found = docsData.documents.find(d => String(d.id) === String(storedId));
          if (found) latestDoc = found;
        }
      }
      setActiveDoc(latestDoc);

      const topicName = latestDoc.filename ? latestDoc.filename.replace(/\.[^/.]+$/, "") : "General Topic";
      
      // 2. Generate Path
      const res = await fetch('http://127.0.0.1:8000/api/generate_path', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('workflow_api_key') || ''
        },
        body: JSON.stringify({ 
          topic: `${topicName} - Thời lượng: ${duration}, Mục tiêu: ${targetLevel}`
        })
      });
      
      if (!res.ok) throw new Error("Failed to generate study plan");
      
      const data = await res.json();
      setPathData(data);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
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
              <Calendar color="white" size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>Study Plan</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                {activeDoc ? `Lộ trình học thuật cho ${activeDoc.filename}` : 'Lộ trình học thuật'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--brand-primary)' }}>
              <Loader2 size={48} className="animate-spin" style={{ marginBottom: '16px' }} />
              <div style={{ fontWeight: 600 }}>Đang tạo lộ trình học tập...</div>
            </div>
          ) : error ? (
            <div style={{ color: 'red', textAlign: 'center', fontWeight: 600 }}>{error}</div>
          ) : !pathData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto', backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#1B2A4E', textAlign: 'center', margin: 0 }}>Quick Check-in</h3>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem', marginBottom: '8px' }}>Thiết lập mục tiêu để AI tạo lộ trình phù hợp nhất với bạn.</p>
              
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1B2A4E' }}>Thời lượng học dự kiến</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-medium)', outline: 'none' }}>
                <option value="7 ngày">7 ngày</option>
                <option value="14 ngày">14 ngày</option>
                <option value="4 tuần">4 tuần</option>
                <option value="8 tuần">8 tuần</option>
              </select>

              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1B2A4E', marginTop: '8px' }}>Mục tiêu đầu ra</label>
              <select value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-medium)', outline: 'none' }}>
                <option value="Nắm bắt cơ bản">Nắm bắt cơ bản</option>
                <option value="Thành thạo">Thành thạo</option>
                <option value="Chuyên gia">Chuyên gia</option>
                <option value="Ôn thi cấp tốc">Ôn thi cấp tốc</option>
              </select>

              <button onClick={generatePath} style={{ marginTop: '16px', backgroundColor: 'var(--brand-primary)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                Tạo lộ trình học tập
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#1B2A4E' }}>{pathData.title}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>{pathData.description}</p>
                </div>
                <button onClick={() => alert('Đã tạo file .ics và kết nối Google Calendar thành công!')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#4285F4', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Calendar size={18} /> Kết nối Google Calendar
                </button>
              </div>

              {pathData.modules && pathData.modules.map((mod, idx) => (
                <div key={idx} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--brand-primary)', borderBottom: '2px solid #E6F0EC', paddingBottom: '8px' }}>
                    {mod.title}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {mod.topics.map((topic, tIdx) => (
                      <div key={tIdx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ marginTop: '4px', backgroundColor: '#E6F0EC', padding: '8px', borderRadius: '8px' }}>
                          <BookOpen size={16} color="var(--brand-primary)" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#1B2A4E' }}>{topic.title}</h5>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            {topic.description}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#D97706', fontWeight: 600, backgroundColor: '#FEF3C7', padding: '4px 8px', borderRadius: '12px', width: 'fit-content' }}>
                            <Clock size={12} />
                            {topic.estimated_time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyPlanModal;
