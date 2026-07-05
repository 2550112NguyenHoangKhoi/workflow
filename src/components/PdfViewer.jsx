import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Pages render lazily (IntersectionObserver) so a 100-slide PDF doesn't rasterize
// everything up front. Defined at module level — an inline component would remount
// (and re-render its canvas) on every parent state change.
function PdfPage({ doc, pageNum, width }) {
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
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !doc || !width) return;
    let cancelled = false;
    let renderTask = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setAspect(base.height / base.width);
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
  }, [visible, doc, pageNum, width]);

  return (
    <div
      ref={holderRef}
      style={{
        width, minHeight: Math.round(width * aspect), backgroundColor: '#fff',
        borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

export default function PdfViewer({ url }) {
  const containerRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    const task = pdfjsLib.getDocument({ url });
    task.promise
      .then(d => { if (!cancelled) setDoc(d); else d.destroy(); })
      .catch(e => { if (!cancelled) setError(e.message || 'Không tải được PDF'); });
    return () => { cancelled = true; task.destroy(); };
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pageWidth = Math.max(120, Math.round((containerWidth - 32) * zoom));

  const zoomBtn = {
    width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
          {doc ? `${doc.numPages} trang` : error ? '' : 'Đang tải PDF…'}
        </span>
        <button style={zoomBtn} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Thu nhỏ"><ZoomOut size={14} /></button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button style={zoomBtn} onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} title="Phóng to"><ZoomIn size={14} /></button>
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', backgroundColor: '#E9E4DF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16 }}>
        {error && (
          <div style={{ color: '#EF4444', padding: 24, fontSize: '0.875rem' }}>⚠️ {error}</div>
        )}
        {!doc && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 40 }}>
            <Loader2 size={18} className="animate-spin" /> Đang tải tài liệu…
          </div>
        )}
        {doc && containerWidth > 0 && Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i + 1} doc={doc} pageNum={i + 1} width={pageWidth} />
        ))}
      </div>
    </div>
  );
}
