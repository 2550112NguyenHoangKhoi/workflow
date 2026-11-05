import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, GitBranch, Loader2, Download, ChevronsDownUp, ChevronsUpDown, FileText, BookOpen } from 'lucide-react';
import { ReactFlow, Controls, Background, Handle, Position } from '@xyflow/react';
import { toPng } from 'html-to-image';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { getEngineKey, engineLabel } from '../../utils/engine';
import { useEscape } from '../../utils/useEscape';

// Branch colours (borders/strokes only; text and fills use theme variables for dark mode).
const PALETTE = ['#8A334C', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#65A30D', '#B45309', '#4F46E5', '#BE123C', '#0F766E'];

const SIZE = {
  root: { w: 230, h: 64, font: 16 },
  topic: { w: 210, h: 52, font: 14 },
  section: { w: 200, h: 48, font: 13 },
  subsection: { w: 190, h: 38, font: 12 },
  concept: { w: 160, h: 34, font: 12 },
};
// Height grows with the label (up to 3 lines) so dagre leaves room for wrapped labels.
const sizeOf = (kind, label = '') => {
  const base = SIZE[kind] || SIZE.concept;
  const perLine = Math.max(10, Math.floor((base.w - 24) / (base.font * 0.55)));
  const lines = Math.min(3, Math.max(1, Math.ceil(label.length / perLine)));
  return { ...base, h: Math.max(base.h, lines * base.font * 1.3 + 16) };
};

function MindNode({ data }) {
  const s = sizeOf(data.kind, data.label);
  const isRoot = data.kind === 'root';
  return (
    <div title={data.definition || data.label} style={{
      width: s.w, minHeight: s.h, boxSizing: 'border-box', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
      justifyContent: 'center', textAlign: 'center', fontSize: s.font, lineHeight: 1.25, fontWeight: isRoot ? 900 : data.kind === 'concept' || data.kind === 'subsection' ? 600 : 800,
      color: isRoot ? 'white' : 'var(--text-navy)',
      backgroundColor: isRoot ? 'var(--brand-primary)' : data.kind === 'concept' ? 'var(--bg-tertiary)' : 'var(--surface-plain)',
      border: `2px solid ${isRoot ? 'var(--brand-primary)' : data.color}`,
      borderRadius: data.kind === 'concept' || data.kind === 'subsection' ? 999 : 12,
      boxShadow: isRoot ? '0 6px 16px rgba(0,0,0,0.18)' : '0 2px 6px rgba(0,0,0,0.08)',
      opacity: data.dim ? 0.35 : 1, cursor: 'pointer',
    }}>
      <Handle type="target" position={data.side === 'left' ? Position.Right : Position.Left} style={{ opacity: 0 }} />
      <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{data.label}</span>
      {data.hiddenCount > 0 && (
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: 'white', backgroundColor: data.color, borderRadius: 999, padding: '1px 6px' }}>+{data.hiddenCount}</span>
      )}
      <Handle type="source" position={data.side === 'left' ? Position.Left : Position.Right} style={{ opacity: 0 }} />
      {isRoot && <Handle id="l" type="source" position={Position.Left} style={{ opacity: 0 }} />}
    </div>
  );
}
const nodeTypes = { mind: MindNode };

// Root in the middle, first-level branches split between the right and the left side
// (balanced by leaf count), each side laid out as a left-to-right tree with dagre.
function layoutMindMap(nodes, collapsed) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const children = new Map();
  nodes.forEach(n => { if (n.parent && byId.has(n.parent)) { (children.get(n.parent) || children.set(n.parent, []).get(n.parent)).push(n.id); } });
  const root = nodes.find(n => !n.parent || !byId.has(n.parent));
  if (!root) return { placed: [], visible: new Set(), side: new Map(), color: new Map(), hidden: new Map() };

  const visible = new Set([root.id]);
  const hidden = new Map();
  const countDesc = (id) => (children.get(id) || []).reduce((a, c) => a + 1 + countDesc(c), 0);
  const walk = (id) => {
    if (collapsed.has(id)) { hidden.set(id, countDesc(id)); return; }
    for (const c of children.get(id) || []) { visible.add(c); walk(c); }
  };
  walk(root.id);

  const leaves = (id) => { const ch = (children.get(id) || []).filter(c => visible.has(c)); return ch.length ? ch.reduce((a, c) => a + leaves(c), 0) : 1; };
  const branches = (children.get(root.id) || []).filter(c => visible.has(c));
  const side = new Map([[root.id, 'right']]);
  const color = new Map([[root.id, PALETTE[0]]]);
  // Reading order is clockwise: the first branches (by leaf count, half the map) on the right,
  // the rest on the left — alternating sides scattered consecutive sections across the map.
  const total = branches.reduce((a, b) => a + leaves(b), 0);
  let acc = 0;
  branches.forEach((b, i) => {
    const w = leaves(b);
    const s = branches.length <= 2 || acc + w / 2 <= total / 2 ? 'right' : 'left';
    acc += w;
    const paint = (id) => { side.set(id, s); color.set(id, PALETTE[i % PALETTE.length]); (children.get(id) || []).forEach(paint); };
    paint(b);
  });

  const placed = new Map();
  const rs = sizeOf(root.kind, root.label);
  placed.set(root.id, { x: -rs.w / 2, y: -rs.h / 2 });
  for (const s of ['right', 'left']) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 60 });
    const ids = [...visible].filter(id => id !== root.id && side.get(id) === s);
    if (!ids.length) continue;
    g.setNode('__root', { width: rs.w, height: rs.h });
    ids.forEach(id => { const z = sizeOf(byId.get(id).kind, byId.get(id).label); g.setNode(id, { width: z.w, height: z.h }); });
    ids.forEach(id => { const p = byId.get(id).parent; g.setEdge(p === root.id ? '__root' : p, id); });
    dagre.layout(g);
    const r0 = g.node('__root');
    ids.forEach(id => {
      const p = g.node(id); const z = sizeOf(byId.get(id).kind, byId.get(id).label);
      const dx = p.x - r0.x, dy = p.y - r0.y;
      const x = s === 'right' ? dx : -dx;
      placed.set(id, { x: x - z.w / 2, y: dy - z.h / 2 });
    });
  }
  return { placed, visible, side, color, hidden, children };
}

const MindMapModal = ({ isOpen, onClose, documentId, projectId, onOpenConceptMap }) => {
  useEscape(isOpen, onClose);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scope, setScope] = useState('auto');          // auto | document | subject
  const [docProject, setDocProject] = useState(null);  // project the open document belongs to
  const [collapsed, setCollapsed] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState(0);
  const wrapRef = useRef(null);

  // Which project (if any) the document belongs to → "Cả môn" option.
  useEffect(() => {
    if (!isOpen || projectId || !documentId) { setDocProject(null); return; }
    fetch(`http://127.0.0.1:8000/api/documents/${documentId}`).then(r => r.ok ? r.json() : null)
      .then(d => setDocProject(d?.project_id || null)).catch(() => setDocProject(null));
  }, [isOpen, documentId, projectId]);

  const load = useCallback(async (which) => {
    setLoading(true); setError(null); setSelected(null);
    try {
      const useProject = which === 'subject' ? (projectId || docProject) : (which === 'document' ? null : projectId);
      const body = useProject
        ? { project_id: Number(useProject), scope: which === 'document' ? 'document' : 'auto' }
        : { document_id: Number(documentId), scope: which === 'subject' ? 'auto' : 'document' };
      if (!body.project_id && !body.document_id) throw new Error('Mở một tài liệu hoặc dự án để tạo sơ đồ tư duy.');
      const res = await fetch('http://127.0.0.1:8000/api/mindmap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, api_key: getEngineKey() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || 'Không tạo được sơ đồ tư duy.');
      setData(json);
      // Big maps open with the deepest level folded so the first view is readable.
      const deep = (json.nodes || []).filter(n => n.depth === 1 && (json.nodes || []).filter(m => m.parent === n.id).length > 0);
      setCollapsed(new Set((json.nodes || []).length > 45 ? deep.map(n => n.id) : []));
      setVersion(v => v + 1);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [documentId, projectId, docProject]);

  useEffect(() => {
    if (isOpen) load(scope);
    else { setData(null); setError(null); setSelected(null); setScope('auto'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, documentId, projectId]);

  const layout = useMemo(() => data ? layoutMindMap(data.nodes || [], collapsed) : null, [data, collapsed]);

  const flowNodes = useMemo(() => {
    if (!data || !layout) return [];
    return (data.nodes || []).filter(n => layout.visible.has(n.id)).map(n => ({
      id: n.id, type: 'mind', position: layout.placed.get(n.id) || { x: 0, y: 0 },
      data: { ...n, side: layout.side.get(n.id), color: layout.color.get(n.id) || PALETTE[0], hiddenCount: layout.hidden.get(n.id) || 0 },
      draggable: true,
    }));
  }, [data, layout]);

  const flowEdges = useMemo(() => {
    if (!data || !layout) return [];
    const tree = (data.nodes || []).filter(n => n.parent && layout.visible.has(n.id)).map(n => {
      const left = layout.side.get(n.id) === 'left';
      return {
        id: `t-${n.id}`, source: n.parent, target: n.id, type: 'default',
        sourceHandle: n.depth === 1 && left ? 'l' : undefined,
        style: { stroke: layout.color.get(n.id), strokeWidth: n.depth === 1 ? 3 : 1.6 },
      };
    });
    const cross = (data.links || []).filter(l => layout.visible.has(l.source) && layout.visible.has(l.target)).map((l, i) => ({
      id: `x-${i}`, source: l.source, target: l.target, type: 'default', label: l.label || undefined, animated: false,
      style: { stroke: 'var(--text-muted)', strokeWidth: 1.4, strokeDasharray: '6 4' },
      labelStyle: { fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 },
      labelBgStyle: { fill: 'var(--surface-plain)' },
    }));
    return [...tree, ...cross];
  }, [data, layout]);

  const toggle = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const onNodeClick = (_, node) => {
    setSelected(node.data);
    const hasKids = (data?.nodes || []).some(n => n.parent === node.id);
    if (hasKids && node.data.kind !== 'root') toggle(node.id);
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set((data?.nodes || []).filter(n => n.depth === 1).map(n => n.id)));

  const exportPng = () => {
    if (!wrapRef.current) return;
    toPng(wrapRef.current, { backgroundColor: getComputedStyle(document.body).backgroundColor || '#fff' })
      .then(url => { const a = document.createElement('a'); a.download = `MindMap_${(data?.title || 'export').replace(/\W+/g, '_')}.png`; a.href = url; a.click(); })
      .catch(err => console.error('Mind map export failed', err));
  };

  const openPage = (n) => {
    if (!n?.page) return;
    const target = n.doc_id || documentId;
    try { sessionStorage.setItem('pdf_goto', JSON.stringify({ docId: Number(target), page: n.page })); } catch { /* storage off */ }
    window.dispatchEvent(new CustomEvent('pdf-goto', { detail: { docId: Number(target), page: n.page } }));
    if (!window.location.hash.includes(`/document/${target}`) && !projectId) window.location.hash = `#/document/${target}`;
    onClose();
  };

  if (!isOpen) return null;
  const canSubject = Boolean(projectId || docProject);
  const tab = (active) => ({
    padding: '6px 12px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
    backgroundColor: active ? 'var(--brand-primary)' : 'transparent', color: active ? 'white' : 'var(--text-secondary)',
  });
  const iconBtn = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' };
  const mode = data?.mode;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(27, 42, 78, 0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div role="dialog" aria-label="Sơ đồ tư duy" style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 20, width: '96vw', maxWidth: 1400, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', backgroundColor: 'var(--surface-blush)' }}>
          <div style={{ backgroundColor: 'var(--brand-primary)', padding: 8, borderRadius: 10, display: 'flex' }}><GitBranch color="white" size={20} /></div>
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-navy)', fontWeight: 800 }}>Sơ đồ tư duy{data?.title ? ` · ${data.title}` : ''}</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {mode === 'subject' ? 'Toàn môn: mỗi nhánh là một chủ đề, nét đứt nối các chủ đề có khái niệm chung.' : 'Một tài liệu: các phần chính → ý nhỏ → khái niệm.'}
              {' '}Bấm một nhánh để mở/thu gọn. {data ? `(${data.engine === 'ai' ? engineLabel() : 'offline'})` : ''}
            </p>
          </div>
          {canSubject && (
            <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--surface-grey)', padding: 4, borderRadius: 999 }}>
              <button style={tab(scope !== 'subject')} onClick={() => { setScope('document'); load('document'); }}>{projectId ? 'Từng tài liệu' : 'Tài liệu này'}</button>
              <button style={tab(scope === 'subject')} onClick={() => { setScope('subject'); load('subject'); }}>Cả môn</button>
            </div>
          )}
          <button style={iconBtn} onClick={expandAll} title="Mở tất cả nhánh"><ChevronsUpDown size={15} /> Mở hết</button>
          <button style={iconBtn} onClick={collapseAll} title="Thu gọn về các nhánh chính"><ChevronsDownUp size={15} /> Thu gọn</button>
          {onOpenConceptMap && <button style={iconBtn} onClick={onOpenConceptMap} title="Đồ thị khái niệm có trọng số">Bản đồ khái niệm</button>}
          {data && <button style={{ ...iconBtn, backgroundColor: 'var(--surface-green)', color: '#065F46', border: 'none' }} onClick={exportPng}><Download size={15} /> PNG</button>}
          <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={22} /></button>
        </div>

        {data?.hint && !loading && (
          <div style={{ padding: '8px 18px', fontSize: '0.8rem', color: 'var(--accent-amber-text)', backgroundColor: 'var(--accent-amber-bg)', borderBottom: '1px solid var(--border-light)' }}>{data.hint}</div>
        )}

        <div ref={wrapRef} style={{ flex: 1, position: 'relative', backgroundColor: 'var(--surface-plain)' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--brand-primary)', gap: 12 }}>
              <Loader2 size={40} className="animate-spin" /> <div style={{ fontWeight: 600 }}>Đang dựng sơ đồ tư duy…</div>
            </div>
          ) : error ? (
            <div style={{ padding: 24, color: '#EF4444' }}>⚠️ {error}</div>
          ) : (
            <ReactFlow key={version} nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodeClick={onNodeClick}
              onPaneClick={() => setSelected(null)} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.15} nodesConnectable={false}
              proOptions={{ hideAttribution: true }}>
              <Background color="var(--border-light)" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}

          {selected && (
            <div className="animate-fade-in" style={{ position: 'absolute', left: 16, bottom: 16, maxWidth: 460, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: 14, padding: 16, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-navy)' }}>{selected.label}</h3>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selected.definition || 'Chưa có câu định nghĩa trong tài liệu.'}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {selected.page && (
                  <button onClick={() => openPage(selected)} style={{ ...iconBtn, backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none' }}>
                    <FileText size={14} /> Mở trang {selected.page}
                  </button>
                )}
                <button onClick={() => {
                  window.dispatchEvent(new CustomEvent('chat-ask', { detail: { text: `Giải thích "${selected.label}" dựa trên tài liệu.` } }));
                  onClose();
                }} style={iconBtn}><BookOpen size={14} /> Hỏi AI về mục này</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MindMapModal;
