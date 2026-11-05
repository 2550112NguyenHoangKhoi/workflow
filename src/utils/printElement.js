// Print (→ "Save as PDF") one rendered element in a clean page: copies the element's HTML and
// the app's stylesheets into a hidden iframe, so KaTeX and tables keep their styling.
export function printElement(el, title = 'Workflow') {
  if (!el) return;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('\n');
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(title).replace(/</g, '&lt;')}</title>${styles}
    <style>body{background:#fff;color:#111;padding:24px;font-family:system-ui,sans-serif}
    .markdown-body{color:#111} table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:6px;vertical-align:top}
    @page{margin:16mm}</style></head><body><div class="markdown-body">${el.innerHTML}</div></body></html>`);
  doc.close();
  const go = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  // Give fonts/stylesheets a moment to load in the frame.
  setTimeout(go, 400);
}
