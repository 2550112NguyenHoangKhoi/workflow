import { useEffect } from 'react';

// Close a modal with the Escape key (none of the dialogs responded to it).
export function useEscape(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
}
