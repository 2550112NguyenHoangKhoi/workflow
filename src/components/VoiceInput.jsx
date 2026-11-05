import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

/**
 * Mic button: speech → text. Uses the browser's SpeechRecognition when it works (Chrome/Edge);
 * otherwise (Electron has the API but no Google speech service → "network" error, Firefox has
 * none) records with MediaRecorder and sends the audio to /api/transcribe (faster-whisper).
 *
 * props: onText(text, { final }), lang ('vi-VN' | 'en-US'), title
 */
export default function VoiceInput({ onText, lang = 'vi-VN', title = 'Nói thay vì gõ', size = 36 }) {
  const [state, setState] = useState('idle'); // idle | listening | recording | transcribing
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const useRecorderRef = useRef(false);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* none */ } try { mediaRef.current?.stop(); } catch { /* none */ } }, []);

  const startRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setState('transcribing');
        try {
          const fd = new FormData();
          fd.append('file', new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' }), 'speech.webm');
          fd.append('lang', lang.slice(0, 2));
          const res = await fetch('http://127.0.0.1:8000/api/transcribe', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Không chuyển được giọng nói thành chữ.');
          if (data.text) onText(data.text, { final: true });
        } catch (e) { setError(e.message); }
        setState('idle');
      };
      mediaRef.current = mr;
      mr.start();
      setState('recording');
    } catch {
      setError('Không truy cập được micro. Hãy cấp quyền micro cho ứng dụng.');
      setState('idle');
    }
  };

  const start = () => {
    setError(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || useRecorderRef.current) { startRecorder(); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim(), { final: true });
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'network' || e.error === 'service-not-allowed') {
        // No cloud speech service here (Electron): fall back to recording + local transcription.
        useRecorderRef.current = true;
        setState('idle');
        startRecorder();
      } else if (e.error === 'not-allowed') {
        setError('Không truy cập được micro. Hãy cấp quyền micro.');
      }
    };
    rec.onend = () => setState(s => (s === 'listening' ? 'idle' : s));
    recRef.current = rec;
    try { rec.start(); setState('listening'); } catch { startRecorder(); }
  };

  const stop = () => {
    if (state === 'listening') { try { recRef.current?.stop(); } catch { /* none */ } setState('idle'); }
    if (state === 'recording') { try { mediaRef.current?.stop(); } catch { /* none */ } }
  };

  const active = state === 'listening' || state === 'recording';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={active ? stop : start} disabled={state === 'transcribing'} title={active ? 'Dừng ghi âm' : title} aria-label={active ? 'Dừng ghi âm' : title}
        style={{ width: size, height: size, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: active ? '#DC2626' : 'var(--brand-primary)', color: 'white', boxShadow: active ? '0 0 0 4px rgba(220,38,38,0.25)' : 'none' }}>
        {state === 'transcribing' ? <Loader2 size={16} className="animate-spin" /> : active ? <Square size={14} /> : <Mic size={16} />}
      </button>
      {active && <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 700 }}>Đang nghe…</span>}
      {error && <span style={{ fontSize: '0.75rem', color: '#DC2626', maxWidth: 260 }}>{error}</span>}
    </span>
  );
}
