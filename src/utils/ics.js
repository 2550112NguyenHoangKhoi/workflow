// Build an iCalendar (.ics) file from a learning path so it can be imported into Google
// Calendar, Apple Calendar or Outlook. Pure client-side; no account connection needed.

const pad = (n) => String(n).padStart(2, '0');
const fmtLocal = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const fmtUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// RFC 5545 text escaping + line folding at 75 octets (approximated by characters).
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => {
  const out = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? ' ' : '') + line.slice(i, i + 73));
  return out.join('\r\n');
};

/** "7 ngày" -> 7, "4 tuần" -> 28, default 14. */
export function durationToDays(label) {
  const m = String(label || '').match(/(\d+)\s*(ngày|day|tuần|week)/i);
  if (!m) return 14;
  const n = parseInt(m[1], 10);
  return /tuần|week/i.test(m[2]) ? n * 7 : n;
}

/** "45 mins" / "1.5 hours" / "2 giờ" / "30 phút" -> minutes (default 60, clamp 15..240). */
export function estimateToMinutes(text) {
  const s = String(text || '').toLowerCase();
  const num = parseFloat((s.match(/\d+(?:[.,]\d+)?/) || ['60'])[0].replace(',', '.'));
  const minutes = /hour|hr|giờ|tiếng/.test(s) ? num * 60 : num;
  return Math.min(240, Math.max(15, Math.round(minutes || 60)));
}

/**
 * One event per topic, spread evenly over `days` days starting tomorrow at `hour`:00 local.
 * Returns the .ics text.
 */
export function buildStudyPlanIcs(plan, { days = 14, hour = 19 } = {}) {
  const topics = [];
  (plan?.modules || []).forEach((mod) =>
    (mod.topics || []).forEach((t) => topics.push({ module: mod.title, ...t })));
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(hour, 0, 0, 0);
  const stamp = fmtUtc(new Date());
  const step = topics.length > 1 ? (days - 1) / (topics.length - 1) : 0;

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workflow//Study Plan//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(plan?.title || 'Lộ trình học')}`)];
  topics.forEach((t, i) => {
    const begin = new Date(start);
    begin.setDate(start.getDate() + Math.round(i * step));
    const end = new Date(begin.getTime() + estimateToMinutes(t.estimated_time) * 60000);
    lines.push('BEGIN:VEVENT',
      `UID:${stamp}-${i}@workflow.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtLocal(begin)}`,
      `DTEND:${fmtLocal(end)}`,
      fold(`SUMMARY:${esc(`📚 ${t.title}`)}`),
      fold(`DESCRIPTION:${esc(`${t.module || ''}\n\n${t.description || ''}`)}`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Đến giờ học', 'TRIGGER:-PT10M', 'END:VALARM',
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/**
 * Roadmap steps that carry a due_date (from a deadline) → one evening session per step on its
 * date. Steps without a date are skipped. Uses the study plan builder's event format.
 */
export function buildRoadmapIcs(items, { title = 'Lộ trình học', hour = 19 } = {}) {
  const stamp = fmtUtc(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workflow//Roadmap//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(title)}`)];
  (items || []).filter(it => it.due_date).forEach((it, i) => {
    const [y, m, d] = it.due_date.split('-').map(Number);
    const begin = new Date(y, m - 1, d, hour, 0, 0);
    const end = new Date(begin.getTime() + estimateToMinutes(it.estimated_time) * 60000);
    lines.push('BEGIN:VEVENT', `UID:${stamp}-rm${i}@workflow.local`, `DTSTAMP:${stamp}`,
      `DTSTART:${fmtLocal(begin)}`, `DTEND:${fmtLocal(end)}`,
      fold(`SUMMARY:${esc(`📚 Bước ${it.step_number ?? i + 1}: ${it.title}`)}`),
      fold(`DESCRIPTION:${esc(it.description || '')}`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Đến giờ học', 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
