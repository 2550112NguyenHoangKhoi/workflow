import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, Download, Trash2, CheckCircle2, XCircle, Loader2, Play, Server, HardDrive, Zap, X } from 'lucide-react';

const API = 'http://127.0.0.1:8000/api/local';
const gb = (b) => `${(b / 1e9).toFixed(1)} GB`; // decimal GB, as download sites show
const SERVER_PRESETS = [
  ['Ollama', 'http://127.0.0.1:11434'],
  ['LM Studio', 'http://127.0.0.1:1234'],
  ['llama.cpp', 'http://127.0.0.1:8080'],
];

/**
 * Settings → AI engine → "Model cục bộ": run AI on this computer instead of a cloud API key.
 * Built-in Gemma 4 (Google LiteRT: Metal on Apple Silicon, DirectX 12 on Windows, CPU anywhere)
 * or a local OpenAI-compatible server (Ollama / LM Studio / llama.cpp). Both go through the
 * Antigravity harness on the backend (core/local_models.py).
 */
export default function LocalModelPanel() {
  const [hw, setHw] = useState(null);
  const [data, setData] = useState(null);       // { models, runtime, config }
  const [cfg, setCfg] = useState(null);
  const [serverModels, setServerModels] = useState(null);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);
  const poll = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await (await fetch(`${API}/models`)).json();
      setData(d);
      setCfg(c => c || d.config);
      return d;
    } catch { return null; }
  }, []);

  useEffect(() => {
    fetch(`${API}/hardware`).then(r => r.json()).then(setHw).catch(() => setHw({ error: true }));
    load();
    return () => clearInterval(poll.current);
  }, [load]);

  // Poll while a download runs.
  useEffect(() => {
    const busy = data?.models?.some(m => ['starting', 'downloading'].includes(m.download?.state));
    clearInterval(poll.current);
    if (busy) poll.current = setInterval(load, 1000);
  }, [data, load]);

  const save = async (patch) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    setTest(null);
    try { await fetch(`${API}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); } catch { /* offline */ }
  };

  const download = async (id) => { await fetch(`${API}/models/${id}/download`, { method: 'POST' }); load(); };
  const cancel = async (id) => { await fetch(`${API}/models/${id}/download`, { method: 'DELETE' }); setTimeout(load, 500); };
  const remove = async (id) => {
    if (!window.confirm('Xoá file model khỏi máy?')) return;
    await fetch(`${API}/models/${id}`, { method: 'DELETE' }); load();
  };
  const checkServer = async (url = cfg.server_url) => {
    setServerModels('loading');
    try {
      const d = await (await fetch(`${API}/server/models?url=${encodeURIComponent(url)}`)).json();
      setServerModels(d);
      if (d.models?.length && !d.models.includes(cfg.server_model)) save({ server_model: d.models[0] });
    } catch { setServerModels({ reachable: false, models: [] }); }
  };
  const runTest = async () => {
    setTesting(true); setTest(null);
    try { setTest(await (await fetch(`${API}/test`, { method: 'POST' })).json()); } catch { setTest({ ok: false, error: 'Không kết nối được backend.' }); }
    setTesting(false); load();
  };

  if (!cfg || !hw) return <div style={{ color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}><Loader2 size={16} className="animate-spin" /> Đang kiểm tra phần cứng…</div>;

  const card = { border: '1px solid var(--border-light)', borderRadius: 14, padding: 16, backgroundColor: 'var(--bg-tertiary)' };
  const chip = (active) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
    border: `2px solid ${active ? '#2563EB' : 'var(--border-medium)'}`, backgroundColor: active ? '#2563EB' : 'var(--bg-tertiary)', color: active ? 'white' : 'var(--text-navy)' });
  const small = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-navy)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' };
  const gpuLabel = hw.os === 'macOS' ? 'GPU (Metal)' : hw.os === 'Windows' ? 'GPU (DirectX 12)' : 'GPU';

  return (
    <div data-testid="local-model-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hardware */}
      <div style={{ ...card, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Cpu size={22} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-navy)' }}>Máy của bạn: {hw.os} · {hw.chip || hw.arch} · {hw.ram_gb} GB RAM</div>
          <div>Tăng tốc: <b style={{ color: 'var(--text-navy)' }}>{hw.accelerator}</b>{hw.gpus?.length && hw.os !== 'macOS' ? ` · ${hw.gpus.map(g => g.name + (g.vram_gb ? ` (${g.vram_gb} GB)` : '')).join(', ')}` : ''}{hw.npu ? ' · NPU Intel' : ''}</div>
          <div style={{ marginTop: 4, color: '#1E40AF' }}>{hw.reasoning}</div>
          {(hw.notes || []).map(n => <div key={n} style={{ color: '#B45309' }}>{n}</div>)}
        </div>
      </div>

      {/* Runtime choice */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={chip(cfg.runtime === 'builtin')} onClick={() => save({ runtime: 'builtin' })} disabled={!hw.builtin_supported} title={hw.builtin_supported ? '' : 'Máy này chưa hỗ trợ'}>
          <Zap size={15} /> Gemma tích hợp (khuyên dùng)
        </button>
        <button style={chip(cfg.runtime === 'server')} onClick={() => { save({ runtime: 'server' }); checkServer(); }}>
          <Server size={15} /> Máy chủ cục bộ (Ollama / LM Studio)
        </button>
      </div>

      {cfg.runtime === 'builtin' ? (
        <>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Gemma 4 của Google chạy trực tiếp trong Workflow bằng LiteRT — không cần cài thêm phần mềm, không gửi dữ liệu ra ngoài. Tải model một lần, dùng offline mãi mãi.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.models.map(m => {
              const dl = m.download;
              const active = ['starting', 'downloading'].includes(dl?.state);
              const pct = dl?.total ? Math.round((dl.done / dl.total) * 100) : 0;
              const selected = cfg.model_id === m.id;
              const tooBig = hw.ram_gb && hw.ram_gb < m.min_ram_gb;
              return (
                <div key={m.id} data-testid={`model-${m.id}`} style={{ ...card, borderColor: selected ? '#2563EB' : 'var(--border-light)', borderWidth: selected ? 2 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 800, color: 'var(--text-navy)' }}>
                      <input type="radio" name="local-model" checked={selected} onChange={() => save({ model_id: m.id })} /> {m.name}
                    </label>
                    {hw.recommended_model === m.id && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white', backgroundColor: '#059669', borderRadius: 6, padding: '2px 7px' }}>Gợi ý cho máy này</span>}
                    {tooBig && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#B45309' }}>Cần ≥ {m.min_ram_gb} GB RAM</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{gb(m.size)}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 8px' }}>{m.desc}</div>
                  {active ? (
                    <div>
                      <div style={{ height: 8, borderRadius: 4, backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2563EB', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {pct}% · {gb(dl.done)} / {gb(dl.total)}{dl.speed_mbps ? ` · ${dl.speed_mbps} MB/s` : ''}
                        <button style={{ ...small, padding: '3px 8px', marginLeft: 'auto' }} onClick={() => cancel(m.id)}><X size={12} /> Huỷ</button>
                      </div>
                    </div>
                  ) : m.installed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={15} /> Đã tải</span>
                      {data.runtime?.loaded && data.runtime.model_id === m.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· đang chạy ({data.runtime.backend === 'gpu' ? gpuLabel : data.runtime.backend?.toUpperCase()})</span>}
                      <button style={{ ...small, marginLeft: 'auto' }} onClick={() => remove(m.id)}><Trash2 size={13} /> Xoá</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button style={{ ...small, backgroundColor: '#2563EB', color: 'white', border: 'none' }} onClick={() => download(m.id)}>
                        <Download size={13} /> {dl?.state === 'error' || dl?.state === 'cancelled' ? 'Tải tiếp' : 'Tải về'}
                      </button>
                      {dl?.state === 'error' && <span style={{ fontSize: '0.75rem', color: '#B91C1C' }}>{dl.error}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-navy)' }}>Phần cứng chạy model:</span>
            {[['auto', 'Tự động'], ...hw.backends.map(b => [b, b === 'gpu' ? gpuLabel : b === 'npu' ? 'NPU (Intel, thử nghiệm)' : 'CPU'])].map(([b, l]) => (
              <button key={b} style={{ ...chip(cfg.backend === b), padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => save({ backend: b })}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Nếu GPU không khởi động được (driver cũ…), Workflow tự chuyển sang CPU. Model lưu tại: <code>{data.models_dir}</code>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Dùng model bạn đã có trong <a href="https://ollama.com/download" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>Ollama</a>, <a href="https://lmstudio.ai" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>LM Studio</a> hoặc llama.cpp (bất kỳ máy chủ tương thích OpenAI nào trên máy).
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SERVER_PRESETS.map(([n, u]) => <button key={n} style={{ ...chip(cfg.server_url === u), padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => { save({ server_url: u, server_model: '' }); checkServer(u); }}>{n}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={cfg.server_url} onChange={e => setCfg({ ...cfg, server_url: e.target.value })} onBlur={() => save({ server_url: cfg.server_url })} aria-label="Địa chỉ máy chủ"
              style={{ flex: 1, padding: 10, borderRadius: 10, border: '2px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)', fontFamily: 'monospace' }} />
            <button style={small} onClick={() => checkServer()}><HardDrive size={14} /> Kiểm tra</button>
          </div>
          {serverModels === 'loading' && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang kết nối…</div>}
          {serverModels && serverModels !== 'loading' && (serverModels.reachable ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-navy)' }}>
              Model
              <select value={cfg.server_model} onChange={e => save({ server_model: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '2px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-navy)' }}>
                {serverModels.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          ) : (
            <div style={{ color: '#B91C1C', fontSize: '0.85rem' }}>Không kết nối được {cfg.server_url}. Hãy mở Ollama/LM Studio (bật "Local Server") và tải ít nhất một model, ví dụ <code>ollama pull gemma3</code>.</div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={runTest} disabled={testing} data-testid="local-test" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: testing ? 0.7 : 1 }}>
          {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {testing ? 'Đang chạy thử… (lần đầu nạp model)' : 'Chạy thử'}
        </button>
        {test && (test.ok ? (
          <span data-testid="local-test-ok" style={{ color: '#047857', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} /> “{test.reply}” · {test.seconds}s{test.runtime?.backend ? ` · ${test.runtime.backend === 'gpu' ? gpuLabel : test.runtime.backend.toUpperCase()}` : ''}
          </span>
        ) : (
          <span style={{ color: '#B91C1C', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={16} /> {test.error}</span>
        ))}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nếu model cục bộ lỗi hoặc chưa sẵn sàng, Workflow tự dùng bộ máy NLP offline cho tính năng đó.</div>
    </div>
  );
}
