"use client";
import { useEffect, useRef, useState } from "react";

/**
 * State mirrored to localStorage. Reads after mount (so server and client
 * render the same first frame), then writes on every change.
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch { /* private mode or corrupt data: keep initial */ }
    loaded.current = true;
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [key, value]);

  return [value, setValue, ready];
}
