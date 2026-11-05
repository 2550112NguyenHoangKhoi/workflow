import React, { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { FileText, StickyNote, MessageCircle, ClipboardCheck, Sparkles, Plus, ArrowLeft, Trash2, Loader2, Send, GraduationCap } from 'lucide-react';
import { getEngineKey } from '../utils/engine';

const API = 'http://127.0.0.1:8000';

/*
 * Canvas workspace: documents, notes, AI chat, review sets and syntheses as nodes on a board.
 * Drag from a node's dot to another node to connect them — AI nodes work from the content of
 * every node connected to them. Saved per project / document (/api/canvas).
 */
const CanvasCtx = createContext(null);

const KIND = {
  document: { label: 'Tài liệu', color: '#2563EB', icon: FileText },
  note: { label: 'Ghi chú', color: '#D97706', icon: StickyNote },
  chat: { label: 'Chat AI', color: '#059669', icon: MessageCircle },
  review: { label: 'Ôn tập', color: '#DC2626', icon: ClipboardCheck },
  synthesis: { label: 'Tổng hợp', color: '#7C3AED', icon: Sparkles },
};

function Shell({ id, kind, title, children, width = 300 }) {
  const { removeNode, linkedCount } = useContext(CanvasCtx);
  const K = KIND[kind];
  const Icon = K.icon;
  return (
    <div style={{ width, backgroundColor: 'var(--bg-tertiary)', border: `2px solid ${K.color}`, borderRadius: 14, boxShadow: '0 6px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      <Handle type="target" position={Position.Left} style={{ width: 12, height: 12, background: K.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', backgroundColor: 'var(--surface-plain)', borderBottom: '1px solid var(--border-light)' }}>
        <Icon size={15} color={K.color} />
        <b style={{ fontSize: '0.8rem', color: 'var(--text-navy)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || K.label}</b>
        {kind !== 'document' && kind !== 'note' && <span title="Số nguồn đang nối vào" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{linkedCount(id)} nguồn</span>}
        <button className="nodrag" onClick={() => removeNode(id)} aria-label="Xoá node" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}><Trash2 size={13} /></button>
      </div>
      <div className="nodrag nowheel" style={{ padding: 10, cursor: 'default' }}>{children}</div>
      <Handle type="source" position={Position.Right} style={{ width: 12, height: 12, background: K.color }} />
    </div>
  );
}

const small = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-navy)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' };
const needLinks = <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kéo từ dấu chấm của một tài liệu/ghi chú vào node này để AI dựa trên nội dung đó.</div>;

function DocumentNode({ id, data }) {
  const navigate = useNavigate();
  const { docText } = useContext(CanvasCtx);
  const text = docText(data.doc_id);
  return (
    <Shell id={id} kind="document" title={data.title}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, maxHeight: 90, overflow: 'hidden' }}>{text ? text.slice(0, 260) + '…' : 'Đang tải nội dung…'}</div>
      <button style={{ ...small, marginTop: 8 }} onClick={() => navigate(`/document/${data.doc_id}`)}>Mở tài liệu</button>
    </Shell>
  );
}

function NoteNode({ id, data }) {
  const { updateData, addNodeFrom } = useContext(CanvasCtx);
  return (
    <Shell id={id} kind="note" title={data.title || 'Ghi chú'} width={280}>
      <input value={data.title || ''} onChange={e => updateData(id, { title: e.target.value })} placeholder="Tiêu đề ghi chú…"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6, padding: 6, borderRadius: 6, border: '1px solid var(--border-light)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)', fontWeight: 700 }} />
      <textarea rows={6} value={data.text || ''} onChange={e => updateData(id, { text: e.target.value })} placeholder="Ghi chú của bạn (Markdown, $LaTeX$)…"
        style={{ width: '100%', boxSizing: 'border-box', padding: 6, borderRadius: 6, border: '1px solid var(--border-light)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)', fontFamily: 'inherit', resize: 'vertical' }} />
      <button style={{ ...small, marginTop: 6 }} disabled={!(data.text || '').trim()} onClick={() => addNodeFrom(id, 'synthesis', { format: 'notes', auto: true, title: `Bài học: ${(data.title || 'ghi chú').slice(0, 30)}` })}>
        <Sparkles size={12} /> Tạo bài học từ ghi chú
      </button>
    </Shell>
  );
}

function ChatNode({ id, data }) {
  const { contextFor, updateData, linkedCount } = useContext(CanvasCtx);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const msgs = data.messages || [{ role: 'assistant', text: 'Bạn muốn hỏi gì về nội dung đã nối?' }];
  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput(''); setBusy(true);
    const next = [...msgs, { role: 'user', text: q }];
    updateData(id, { messages: next });
    try {
      const res = await fetch(`${API}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, context: contextFor(id), persona: null, api_key: getEngineKey() }) });
      const d = await res.json();
      updateData(id, { messages: [...next, { role: 'assistant', text: d.response || '…' }] });
    } catch { updateData(id, { messages: [...next, { role: 'assistant', text: '⚠️ Không kết nối được máy chủ.' }] }); }
    setBusy(false);
  };
  return (
    <Shell id={id} kind="chat" title={data.title || 'Chat AI'} width={340}>
      {linkedCount(id) === 0 && needLinks}
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, margin: '6px 0' }}>
        {msgs.map((m, i) => (
          <div key={i} className="markdown-body" style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', fontSize: '0.78rem', padding: '6px 9px', borderRadius: 10,
            backgroundColor: m.role === 'user' ? 'var(--brand-primary)' : 'var(--surface-plain)', color: m.role === 'user' ? 'white' : 'var(--text-ink)' }}>
            {m.role === 'user' ? m.text : <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{m.text}</ReactMarkdown>}
          </div>
        ))}
        {busy && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đang nghĩ…</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Hỏi tiếp…"
          style={{ flex: 1, padding: 6, borderRadius: 8, border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)' }} />
        <button style={small} onClick={send} aria-label="Gửi"><Send size={13} /></button>
      </div>
    </Shell>
  );
}

function ReviewNode({ id, data }) {
  const { contextFor, updateData, linkedCount } = useContext(CanvasCtx);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(data.tab || 'quiz');
  const [picked, setPicked] = useState({});
  const [flip, setFlip] = useState({});
  const generate = async () => {
    const text = contextFor(id);
    if (!text.trim()) return;
    setBusy(true);
    try {
      const [q, f] = await Promise.all([
        fetch(`${API}/api/generate_quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic_or_text: text.slice(0, 40000), api_key: getEngineKey() }) }).then(r => r.json()),
        fetch(`${API}/api/generate_flashcards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic_or_text: text.slice(0, 40000), api_key: getEngineKey() }) }).then(r => r.json()),
      ]);
      updateData(id, { quiz: (q.questions || []).slice(0, 15), cards: (f.flashcards || []).slice(0, 15) });
      setPicked({}); setFlip({});
    } finally { setBusy(false); }
  };
  const quiz = data.quiz || [], cards = data.cards || [];
  const tabBtn = (t, l) => <button style={{ ...small, backgroundColor: tab === t ? 'var(--brand-primary)' : 'var(--bg-primary)', color: tab === t ? 'white' : 'var(--text-navy)' }} onClick={() => { setTab(t); updateData(id, { tab: t }); }}>{l}</button>;
  return (
    <Shell id={id} kind="review" title={data.title || 'Bộ ôn tập'} width={340}>
      {linkedCount(id) === 0 && needLinks}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {tabBtn('quiz', `Quiz (${quiz.length})`)}{tabBtn('cards', `Flashcard (${cards.length})`)}
        <button style={small} onClick={() => { try { sessionStorage.setItem('teach_context', contextFor(id).slice(0, 20000)); } catch { /* storage off */ } navigate('/active-learning'); }}><GraduationCap size={12} /> Dạy AI</button>
        <button style={{ ...small, marginLeft: 'auto' }} onClick={generate} disabled={busy || linkedCount(id) === 0}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {quiz.length ? 'Tạo lại' : 'Tạo bộ ôn tập'}</button>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 'quiz' && quiz.map((q, i) => (
          <div key={i} style={{ fontSize: '0.78rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-navy)', marginBottom: 4 }}>{i + 1}. {q.question}</div>
            {(q.options || []).map(o => {
              const chosen = picked[i]; const done = chosen != null; const ok = o.id === q.correct_option_id;
              return <button key={o.id} onClick={() => !done && setPicked(p => ({ ...p, [i]: o.id }))} style={{ display: 'block', width: '100%', textAlign: 'left', margin: '2px 0', padding: '4px 6px', borderRadius: 6, fontSize: '0.75rem', cursor: done ? 'default' : 'pointer',
                border: `1px solid ${done && ok ? '#059669' : done && chosen === o.id ? '#DC2626' : 'var(--border-light)'}`, backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)' }}>{o.id.toUpperCase()}. {o.text}</button>;
            })}
          </div>
        ))}
        {tab === 'cards' && cards.map((c, i) => (
          <button key={i} onClick={() => setFlip(f => ({ ...f, [i]: !f[i] }))} title="Nhấn để lật thẻ" style={{ textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid var(--border-light)', backgroundColor: flip[i] ? 'var(--surface-blush)' : 'var(--surface-plain)', color: 'var(--text-ink)', fontSize: '0.78rem', cursor: 'pointer' }}>
            {flip[i] ? c.back : c.front.replace(/\*\*/g, '')}
          </button>
        ))}
        {!quiz.length && !cards.length && linkedCount(id) > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bấm “Tạo bộ ôn tập” để sinh quiz và flashcard từ các nguồn đã nối.</div>}
      </div>
    </Shell>
  );
}

const FORMATS = [['outline', 'Đề cương'], ['notes', 'Bài học'], ['table', 'Bảng so sánh'], ['custom', 'Tùy chỉnh']];
function SynthesisNode({ id, data }) {
  const { sourcesFor, updateData, linkedCount } = useContext(CanvasCtx);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fmt = data.format || 'outline') => {
    const { docIds, texts } = sourcesFor(id);
    if (!docIds.length && !texts.length) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/synthesize`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: docIds, texts, format: fmt, instruction: data.instruction || '', api_key: getEngineKey(), save: false }) });
      const d = await res.json();
      updateData(id, { markdown: res.ok ? d.markdown : `⚠️ ${d.detail || 'Không tổng hợp được.'}`, format: fmt, auto: false });
    } finally { setBusy(false); }
  }, [id, data.format, data.instruction, sourcesFor, updateData]);
  useEffect(() => { if (data.auto && linkedCount(id) > 0) run(data.format); }, [data.auto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell id={id} kind="synthesis" title={data.title || 'Tổng hợp'} width={380}>
      {linkedCount(id) === 0 && needLinks}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {FORMATS.map(([f, l]) => <button key={f} style={{ ...small, backgroundColor: (data.format || 'outline') === f ? '#7C3AED' : 'var(--bg-primary)', color: (data.format || 'outline') === f ? 'white' : 'var(--text-navy)' }} onClick={() => updateData(id, { format: f })}>{l}</button>)}
      </div>
      {data.format === 'custom' && <input value={data.instruction || ''} onChange={e => updateData(id, { instruction: e.target.value })} placeholder="Yêu cầu tổng hợp…" style={{ width: '100%', boxSizing: 'border-box', padding: 6, marginBottom: 6, borderRadius: 6, border: '1px solid var(--border-medium)', backgroundColor: 'var(--surface-plain)', color: 'var(--text-ink)' }} />}
      <button style={small} onClick={() => run()} disabled={busy || linkedCount(id) === 0}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Tổng hợp</button>
      {data.markdown && (
        <div className="markdown-body" style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto', fontSize: '0.78rem', padding: 8, borderRadius: 8, backgroundColor: 'var(--surface-plain)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{data.markdown}</ReactMarkdown>
        </div>
      )}
    </Shell>
  );
}

const nodeTypes = { document: DocumentNode, note: NoteNode, chat: ChatNode, review: ReviewNode, synthesis: SynthesisNode };

export default function CanvasWorkspace() {
  const { kind, id } = useParams();             // /canvas/project/:id | /canvas/document/:id
  const scope = `${kind}:${id}`;
  const navigate = useNavigate();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [docs, setDocs] = useState({});          // doc_id → { filename, content }
  const [allDocs, setAllDocs] = useState([]);
  const [saveState, setSaveState] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => {
    setLoaded(false);
    fetch(`${API}/api/canvas?scope=${encodeURIComponent(scope)}`).then(r => r.json()).then(d => {
      setNodes(d.data?.nodes || []); setEdges(d.data?.edges || []); setLoaded(true);
    });
    const listUrl = kind === 'project' ? `${API}/api/documents?project_id=${id}` : `${API}/api/documents`;
    fetch(listUrl).then(r => r.json()).then(d => setAllDocs((d.documents || []).filter(x => kind === 'project' || String(x.id) === String(id))));
  }, [scope, kind, id]);

  // Load the text of every document node (for previews and as AI context).
  useEffect(() => {
    nodes.filter(n => n.type === 'document' && !docs[n.data.doc_id]).forEach(n => {
      fetch(`${API}/api/documents/${n.data.doc_id}`).then(r => r.ok ? r.json() : null).then(d => {
        if (d) setDocs(prev => ({ ...prev, [d.id]: { filename: d.filename, content: d.content || '' } }));
      });
    });
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave (debounced).
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    setSaveState('Đang lưu…');
    saveTimer.current = setTimeout(() => {
      fetch(`${API}/api/canvas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, data: { nodes, edges } }) })
        .then(r => setSaveState(r.ok ? 'Đã lưu' : 'Lưu lỗi')).catch(() => setSaveState('Lưu lỗi'));
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, loaded, scope]);

  const linked = useCallback((nid) => {
    const ids = new Set();
    edges.forEach(e => { if (e.target === nid) ids.add(e.source); if (e.source === nid) ids.add(e.target); });
    return nodes.filter(n => ids.has(n.id));
  }, [nodes, edges]);

  const textOf = useCallback((n) => {
    if (n.type === 'document') return docs[n.data.doc_id]?.content || '';
    if (n.type === 'note') return `${n.data.title || ''}\n${n.data.text || ''}`;
    if (n.type === 'synthesis') return n.data.markdown || '';
    if (n.type === 'chat') return (n.data.messages || []).filter(m => m.role === 'assistant').map(m => m.text).join('\n');
    return '';
  }, [docs]);

  const ctx = useMemo(() => ({
    docText: (docId) => docs[docId]?.content || '',
    linkedCount: (nid) => linked(nid).length,
    contextFor: (nid) => linked(nid).map(n => `[${n.data.title || KIND[n.type].label}]\n${textOf(n)}`).join('\n\n---\n\n'),
    sourcesFor: (nid) => {
      const ln = linked(nid);
      return {
        docIds: ln.filter(n => n.type === 'document').map(n => n.data.doc_id),
        texts: ln.filter(n => n.type !== 'document').map(n => ({ title: n.data.title || KIND[n.type].label, text: textOf(n) })).filter(t => t.text.trim()),
      };
    },
    updateData: (nid, patch) => setNodes(ns => ns.map(n => (n.id === nid ? { ...n, data: { ...n.data, ...patch } } : n))),
    removeNode: (nid) => { setNodes(ns => ns.filter(n => n.id !== nid)); setEdges(es => es.filter(e => e.source !== nid && e.target !== nid)); },
    addNodeFrom: (fromId, type, data = {}) => {
      const from = nodes.find(n => n.id === fromId);
      const nid = `${type}-${Date.now()}`;
      setNodes(ns => [...ns, { id: nid, type, position: { x: (from?.position.x || 0) + 360, y: from?.position.y || 0 }, data }]);
      setEdges(es => [...es, { id: `e-${fromId}-${nid}`, source: fromId, target: nid, animated: true }]);
    },
  }), [docs, linked, textOf, nodes]);

  const onNodesChange = useCallback((ch) => setNodes(ns => applyNodeChanges(ch, ns)), []);
  const onEdgesChange = useCallback((ch) => setEdges(es => applyEdgeChanges(ch, es)), []);
  const onConnect = useCallback((c) => setEdges(es => addEdge({ ...c, animated: true }, es)), []);

  const add = (type, data = {}) => {
    const maxX = nodes.reduce((m, n) => Math.max(m, n.position.x), 0);
    setNodes(ns => [...ns, { id: `${type}-${Date.now()}`, type, position: { x: maxX + 380, y: 60 + (ns.length % 4) * 40 }, data }]);
  };
  const onCanvas = new Set(nodes.filter(n => n.type === 'document').map(n => n.data.doc_id));
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' };

  return (
    <CanvasCtx.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => navigate(kind === 'project' ? `/project/${id}` : `/document/${id}`)}><ArrowLeft size={14} /> Quay lại</button>
          <b style={{ color: 'var(--text-navy)', marginRight: 8 }}>Không gian Canvas</b>
          <button style={btn} onClick={() => add('note', { title: '', text: '' })}><StickyNote size={14} color={KIND.note.color} /> Ghi chú</button>
          <button style={btn} onClick={() => add('chat')}><MessageCircle size={14} color={KIND.chat.color} /> Chat AI</button>
          <button style={btn} onClick={() => add('review')}><ClipboardCheck size={14} color={KIND.review.color} /> Ôn tập</button>
          <button style={btn} onClick={() => add('synthesis', { format: 'outline' })}><Sparkles size={14} color={KIND.synthesis.color} /> Tổng hợp</button>
          {allDocs.some(d => !onCanvas.has(d.id)) && (
            <select value="" onChange={e => { const d = allDocs.find(x => String(x.id) === e.target.value); if (d) add('document', { doc_id: d.id, title: d.filename }); }}
              style={{ ...btn, paddingRight: 8 }} aria-label="Thêm tài liệu">
              <option value="">+ Tài liệu…</option>
              {allDocs.filter(d => !onCanvas.has(d.id)).map(d => <option key={d.id} value={d.id}>{d.filename}</option>)}
            </select>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{saveState} · Kéo dấu chấm để nối node — AI dựa trên nội dung đã nối</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }} data-testid="canvas">
          {loaded && (
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.2} deleteKeyCode={['Delete']} proOptions={{ hideAttribution: true }}>
              <Background gap={20} color="var(--border-light)" />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => KIND[n.type]?.color || '#999'} />
            </ReactFlow>
          )}
        </div>
      </div>
    </CanvasCtx.Provider>
  );
}
