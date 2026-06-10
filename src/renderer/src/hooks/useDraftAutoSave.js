import { useEffect, useRef, useState } from 'react';

export default function useDraftAutoSave(key, data, debounceMs = 2000) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const timerRef = useRef(null);
  const prevRef = useRef(null);

  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (serialized === prevRef.current) return;
    prevRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`draft_${key}`, serialized);
        setLastSaved(new Date());
        setIsSaving(false);
      } catch {
        // localStorage full or unavailable
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, key, debounceMs]);

  const restore = () => {
    try {
      const raw = localStorage.getItem(`draft_${key}`);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  };

  const clear = () => {
    try { localStorage.removeItem(`draft_${key}`); } catch { /* ignore */ }
  };

  return { isSaving, lastSaved, restore, clear };
}
