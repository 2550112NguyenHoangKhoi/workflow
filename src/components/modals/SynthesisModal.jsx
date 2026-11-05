import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, ListTree, NotebookText, Table2, PenLine, Copy, FileDown, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { getEngineKey, engineLabel } from '../../utils/engine';
import { useEscape } from '../../utils/useEscape';
import { printElement } from '../../utils/printElement';

const FORMATS = [
  { id: 'outline', label: 'Đề cương', desc: 'Outline phân cấp, rõ ràng', icon: ListTree },
  { id: 'notes', label: 'Bài học', desc: 'Bài học hoàn chỉnh: mục tiêu, nội dung, lưu ý, câu hỏi', icon: NotebookText },
  { id: 'table', label: 'Bảng so sánh', desc: 'Đối chiếu các tài liệu / khái niệm', icon: Table2 },
  { id: 'custom', label: 'Tùy chỉnh', desc: 'Tự nhập yêu cầu tổng hợp', icon: PenLine },
];

/** AI Tổng hợp: combine selected sources into an outline, a lesson, a comparison table or a custom request. */
export default function SynthesisModal({ isOpen, onClose, projectId, documentId, onSaved }) {
  useEscape(isOpen, onClose);
  const [docs, setDocs] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [format, setFormat] = useState('outline');
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const outRef = useRef(null);

  useEffect(() => {
    if (!isOpen) { setResult(null); setError(null); return; }
    (async () => {
      try {
        let list = [];
        let pid = projectId;
        if (!pid && documentId) {
          const d = await (await fetch(`http://127.0.0.1:8000/api/documents/${documentId}`)).json();
          pid = d.project_id;
          list = [{ id: d.id, filename: d.filename }];
        }
        if (pid) {
          const r = await (await fetch(`http://127.0.0.1:8000/api/documents?project_id=${pid}`)).json();
          list = r.documents || list;
        }
        setDocs(list);
        setPicked(new Set(documentId ? [Number(documentId)] : list.map(d => d.id)));
      } catch { setDocs([]); }
    })();
  }, [isOpen, projectId, documentId]);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/synthesize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: [...picked], format, instruction, api_key: getEngineKey() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Không tổng hợp được.');
      setResult(data);
      onSaved?.();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  const toggle = (id) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const card = (active) => ({ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer',
    border: `2px solid ${active ? 'var(--brand-primary)' : 'var(--border-light)'}`, backgroundColor: active ? 'var(--surface-blush)' : 'var(--bg-primary)', color: 'var(--text-navy)' });
  const small = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(27,42,78,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div role="dialog" aria-label="AI Tổng hợp" style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 20, width: '94vw', maxWidth: 1100, height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--surface-blush)' }}>
          <div style={{ backgroundColor: 'var(--brand-primary)', padding: 8, borderRadius: 10, display: 'flex' }}><Sparkles color="white" size={20} /></div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-navy)' }}>AI Tổng hợp</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Kết nối nhiều tài liệu thành đề cương, bài học hoặc bảng so sánh. Hỗ trợ Markdown và LaTeX.</p>
          </div>
          <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={22} /></button>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0, flexWrap: 'wrap' }}>
          <div style={{ width: 320, maxWidth: '100%', padding: 16, borderRight: '1px solid var(--border-light)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 6 }}>NGUỒN KẾT NỐI ({picked.size})</div>
              {docs.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chưa có tài liệu.</div>}
              {docs.map(d => (
                <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-ink)', padding: '5px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} /> {d.filename}
                </label>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 6 }}>CHỌN HÌNH THỨC TỔNG HỢP</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FORMATS.map(({ id, label, desc, icon: Icon }) => (
                  <button key={id} onClick={() => setFormat(id)} style={card(format === id)}>
                    <Icon size={18} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span><b style={{ fontSize: '0.85rem' }}>{label}</b><br /><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{desc}</span></span>
                  </button>
                ))}
              </div>
              {format === 'custom' && (
                <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={4} placeholder="VD: So sánh DFA và NFA, nêu khi nào dùng mỗi loại"
                  style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)', fontFamily: 'inherit' }} />
              )}
            </div>
            <button onClick={run} disabled={loading || picked.size === 0 || (format === 'custom' && !instruction.trim())}
              style={{ padding: 12, borderRadius: 12, border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', opacity: picked.size === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Đang tổng hợp…</> : <><Sparkles size={16} /> Tổng hợp</>}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {result && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>✓ Đã tổng hợp! ({result.engine === 'ai' ? engineLabel() : 'offline'}) · đã lưu vào Recent artifacts</span>
                <button style={small} onClick={() => { navigator.clipboard?.writeText(result.markdown); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} Sao chép
                </button>
                <button style={small} onClick={() => printElement(outRef.current, result.title)}><FileDown size={14} /> Xuất PDF</button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {error && <div style={{ color: '#EF4444' }}>⚠️ {error}</div>}
              {!result && !error && !loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chọn nguồn và hình thức, rồi bấm “Tổng hợp”.</div>}
              {result && (
                <div ref={outRef} className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{result.markdown}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
