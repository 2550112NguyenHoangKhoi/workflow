import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Loader2, Maximize2, Minimize2, MoveHorizontal, Square } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Pages render lazily (IntersectionObserver) so a 100-slide PDF doesn't rasterize
// everything up front. Defined at module level — an inline component would remount
// (and re-render its canvas) on every parent state change.
function PdfPage({ doc, pageNum, width, onAspect, registerRef }) {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [aspect, setAspect] = useState(1.4142); // A4 portrait until the real page loads

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: '800px' }
    );
    if (holderRef.current) obs.observe(holderRef.current);
    registerRef?.(pageNum, holderRef.current);
    return () => { obs.disconnect(); registerRef?.(pageNum, null); };
  }, [pageNum, registerRef]);

  useEffect(() => {
    if (!visible || !doc || !width) return;
    let cancelled = false;
    let renderTask = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const a = base.height / base.width;
        setAspect(a);
        onAspect?.(a);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport });
        await renderTask.promise;
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.error(`PDF trang ${pageNum}:`, e);
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [visible, doc, pageNum, width, onAspect]);

  return (
    <div
      ref={holderRef}
      data-page={pageNum}
      style={{
        // margin auto (not align-items:center on the parent) so a page wider than the pane
        // can be scrolled to its left edge when zoomed in.
        width, minHeight: Math.round(width * aspect), margin: '0 auto', flexShrink: 0,
        backgroundColor: '#FFFFFF', borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

const GAP = 12;   // between pages
const PAD = 12;   // around the page column

/**
 * Scrollable PDF viewer.
 * Sizing modes: 'width' fits the page to the pane width (default — pages used to be drawn
 * at the pane width minus generous padding, which in the three-column document view meant
 * ~90px thumbnails), 'page' fits a whole page in the visible height (slides), or a fixed
 * zoom factor relative to fit-width.
 */
export default function PdfViewer({ url, docId, initialPage }) {
  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState('width');   // 'width' | 'page' | 'custom'
  const [zoom, setZoom] = useState(1);          // used when mode === 'custom'
  const [aspect, setAspect] = useState(1.4142);
  const [current, setCurrent] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    setCurrent(1);
    const task = pdfjsLib.getDocument({ url });
    task.promise
      .then(d => {
        if (cancelled) { d.destroy(); return; }
        setDoc(d);
        // Landscape documents (slide decks) read best one slide per screen.
        d.getPage(1).then(p => {
          const v = p.getViewport({ scale: 1 });
          setAspect(v.height / v.width);
        }).catch(() => {});
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Không tải được PDF'); });
    return () => { cancelled = true; task.destroy(); };
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const fitWidth = Math.max(160, Math.floor(box.w - 2 * PAD));
  const fitPage = Math.max(160, Math.min(fitWidth, Math.floor((box.h - 2 * PAD) / aspect)));
  const pageWidth = mode === 'width' ? fitWidth
    : mode === 'page' ? fitPage
      : Math.max(160, Math.round(fitWidth * zoom));
  const shownPct = Math.round((pageWidth / Math.max(1, fitWidth)) * 100);

  const registerRef = useCallback((n, el) => {
    if (el) pageRefs.current.set(n, el); else pageRefs.current.delete(n);
  }, []);

  // Track the page in view for the "Trang x / N" counter.
  const onScroll = () => {
    const el = containerRef.current;
    if (!el || !doc) return;
    const mid = el.scrollTop + el.clientHeight / 3;
    let best = 1;
    for (const [n, node] of pageRefs.current) {
      if (node.offsetTop <= mid && n > best) best = n;
    }
    if (best !== current) { setCurrent(best); setPageInput(String(best)); }
  };

  const goTo = (n) => {
    if (!doc) return;
    const p = Math.min(doc.numPages, Math.max(1, Number(n) || 1));
    const node = pageRefs.current.get(p);
    if (node && containerRef.current) containerRef.current.scrollTo({ top: node.offsetTop - PAD, behavior: 'auto' });
    setCurrent(p);
    setPageInput(String(p));
  };

  // Keep the same page in view when the page size changes (zoom / fit / resize).
  const keepPage = useRef(1);
  useEffect(() => { keepPage.current = current; }, [current]);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const node = pageRefs.current.get(keepPage.current);
      if (node && containerRef.current && keepPage.current > 1) containerRef.current.scrollTop = node.offsetTop - PAD;
    });
    return () => cancelAnimationFrame(id);
  }, [pageWidth]);

  // Jump requests: from the mind map / citations (event) or a pending jump stored before navigating here.
  const pendingPage = useRef(initialPage || null);
  useEffect(() => { pendingPage.current = initialPage || null; }, [initialPage, url]);
  useEffect(() => {
    if (!doc || !box.w || !pendingPage.current) return;
    const p = pendingPage.current;
    pendingPage.current = null;
    requestAnimationFrame(() => goTo(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, box.w]);
  useEffect(() => {
    const onGoto = (e) => {
      const { docId: target, page } = e.detail || {};
      if (target != null && docId != null && Number(target) !== Number(docId)) return;
      if (doc) goTo(page); else pendingPage.current = page;
    };
    window.addEventListener('pdf-goto', onGoto);
    return () => window.removeEventListener('pdf-goto', onGoto);
  });

  const zoomBy = (d) => {
    const base = mode === 'custom' ? zoom : pageWidth / Math.max(1, fitWidth);
    setZoom(Math.min(4, Math.max(0.25, +(base + d).toFixed(2))));
    setMode('custom');
  };

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'PageDown' || (mode === 'page' && (e.key === 'ArrowRight' || e.key === 'ArrowDown'))) { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'PageUp' || (mode === 'page' && (e.key === 'ArrowLeft' || e.key === 'ArrowUp'))) { e.preventDefault(); goTo(current - 1); }
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomBy(0.25); }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomBy(-0.25); }
  };

  const btn = (active) => ({
    height: 28, minWidth: 28, borderRadius: 8, border: '1px solid var(--border-medium)',
    backgroundColor: active ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
    color: active ? 'white' : 'var(--text-navy)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 6px', fontSize: '0.72rem', fontWeight: 600,
  });

  return (
    <div ref={rootRef} tabIndex={-1} onKeyDown={onKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, backgroundColor: 'var(--bg-secondary)', outline: 'none' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
        {doc ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>
            Trang
            <input
              aria-label="Đi tới trang"
              value={pageInput}
              onChange={e => setPageInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') goTo(pageInput); }}
              onBlur={() => goTo(pageInput)}
              style={{ width: 38, textAlign: 'center', fontSize: '0.75rem', padding: '3px 2px', borderRadius: 6, border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-ink)' }}
            />
            / {doc.numPages}
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 'auto' }}>{error ? '' : 'Đang tải PDF…'}</span>
        )}
        <button style={btn(mode === 'width')} onClick={() => setMode('width')} title="Vừa chiều rộng"><MoveHorizontal size={14} /></button>
        <button style={btn(mode === 'page')} onClick={() => setMode('page')} title="Vừa một trang (trình chiếu)"><Square size={13} /></button>
        <button style={btn(false)} onClick={() => zoomBy(-0.25)} title="Thu nhỏ (Ctrl −)"><ZoomOut size={14} /></button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: 40, textAlign: 'center' }}>{shownPct}%</span>
        <button style={btn(false)} onClick={() => zoomBy(0.25)} title="Phóng to (Ctrl +)"><ZoomIn size={14} /></button>
        <button style={btn(isFull)} onClick={toggleFull} title={isFull ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
          {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div ref={containerRef} onScroll={onScroll} data-testid="pdf-scroll"
        style={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: 'var(--pdf-canvas-bg, #E9E4DF)', display: 'flex', flexDirection: 'column', gap: GAP, padding: PAD }}>
        {error && (
          <div style={{ color: '#EF4444', padding: 24, fontSize: '0.875rem' }}>⚠️ {error}</div>
        )}
        {!doc && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 40, margin: '0 auto' }}>
            <Loader2 size={18} className="animate-spin" /> Đang tải tài liệu…
          </div>
        )}
        {doc && box.w > 0 && Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i + 1} doc={doc} pageNum={i + 1} width={pageWidth} registerRef={registerRef} />
        ))}
      </div>
    </div>
  );
}
