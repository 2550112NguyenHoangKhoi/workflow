// Interpret a /api/documents/upload or /api/documents/url response.
// The backend rejects unreadable/unsupported sources with 422 + a Vietnamese `detail`, and
// accepts files it couldn't extract text from (scanned PDF, OCR not installed) with `warning`.
export async function readUploadResult(res) {
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    return { ok: false, message: body.detail || `Lỗi máy chủ (${res.status})`, doc: null };
  }
  return { ok: true, message: body.warning || '', warning: Boolean(body.warning), doc: body };
}
