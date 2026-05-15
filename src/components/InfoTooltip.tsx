import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface Props {
  content: React.ReactNode;
  width?: number; // px — default 320
  children?: React.ReactNode; // custom trigger; defaults to Info icon
}

export default function InfoTooltip({ content, width = 320, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const place = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const margin = 12;
    let left = r.left + scrollX + r.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const top = r.top + scrollY - 8;
    setPos({ top, left });
  }, [width]);

  function openTooltip() { place(); setOpen(true); }

  useEffect(() => {
    if (!open) return;
    function onScroll() { place(); }
    function onResize() { place(); }
    function onMouseDown(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, place]);

  const tooltip = open ? createPortal(
    <div
      style={{ position: 'absolute', top: pos.top, left: pos.left, width, zIndex: 9999, transform: 'translateY(-100%)' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl mb-2">
        <div className="p-4 text-xs text-slate-300 leading-relaxed space-y-2.5">
          {content}
        </div>
      </div>
      <div
        style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10 }}
        className="bg-slate-900 border-r border-b border-slate-700"
      />
    </div>,
    document.body,
  ) : null;

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={openTooltip}
        onMouseLeave={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : openTooltip())}
        className={children
          ? 'focus:outline-none'
          : 'text-slate-600 hover:text-slate-400 transition-colors focus:outline-none ml-1'}
        aria-label="More information"
      >
        {children ?? <Info size={12} />}
      </button>
      {tooltip}
    </span>
  );
}
