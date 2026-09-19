"use client";
import { useEffect, useRef } from "react";

/** Bottom sheet: backdrop tap, Escape, or a downward swipe on the handle closes it. */
export default function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);

  const start = (e: React.PointerEvent) => { drag.current = { y: e.clientY, dy: 0 }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const end = () => {
    if (!drag.current || !panel.current) return;
    const far = drag.current.dy > 90;
    drag.current = null;
    if (far) onClose(); else panel.current.style.transform = "";
  };

  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} ref={panel}>
        <span className="grab" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ touchAction: "none", cursor: "grab", padding: "6px 30px", boxSizing: "content-box", backgroundClip: "content-box" }} />
        {children}
      </div>
    </div>
  );
}
