import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Breakdown {
  processingCost: number;
  fxCost: number;
  floatCost: number;
  platformCost: number;
  additionalFixed: number;
  totalPct: number;
  netReceived: number;
}

interface Props {
  breakdown: Breakdown;
  amount: number;
  children: React.ReactElement;
}

const SEGMENTS = [
  { key: 'processingCost' as const, label: 'Processing', color: '#0ea5e9' },
  { key: 'fxCost'          as const, label: 'FX',         color: '#f59e0b' },
  { key: 'floatCost'       as const, label: 'Float',      color: '#3b82f6' },
  { key: 'platformCost'    as const, label: 'Platform',   color: '#64748b' },
  { key: 'additionalFixed' as const, label: 'Additional', color: '#475569' },
];

export default function CostBreakdownHover({ breakdown, amount, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<Element | null>(null);
  const PANEL_W = 260;

  const place = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    let left = r.left + scrollX + r.width / 2 - PANEL_W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - PANEL_W - 12));
    setPos({ top: r.top + scrollY, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => place();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, place]);

  const panel = open ? createPortal(
    <div
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        width: PANEL_W,
        zIndex: 9999,
        transform: 'translateY(calc(-100% - 10px))',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3.5">
        <div className="text-xs font-medium text-slate-300 mb-2.5">Cost Breakdown</div>

        {/* Mini stacked bar */}
        <div className="flex h-2 rounded overflow-hidden mb-3" style={{ gap: '1px' }}>
          {SEGMENTS.map(s => {
            const val = breakdown[s.key];
            const w = amount > 0 ? (val / amount) * 100 : 0;
            return (
              <div
                key={s.key}
                className="h-full"
                style={{ width: `${Math.max(0, w)}%`, backgroundColor: s.color, opacity: 0.85 }}
              />
            );
          })}
        </div>

        <div className="space-y-1">
          {SEGMENTS.map(s => {
            const val = breakdown[s.key];
            const pct = amount > 0 ? (val / amount) * 100 : 0;
            if (pct < 0.001) return null;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-slate-400 flex-1">{s.label}</span>
                <span className="text-xs font-mono text-slate-300">{pct.toFixed(2)}%</span>
              </div>
            );
          })}
          <div className="border-t border-slate-700/60 pt-1 flex items-center gap-2 mt-1">
            <span className="w-2 h-2 flex-shrink-0" />
            <span className="text-xs font-semibold text-white flex-1">Total</span>
            <span className="text-xs font-mono font-bold text-white">{breakdown.totalPct.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm flex-shrink-0 bg-green-500" />
            <span className="text-xs text-green-400 flex-1">Net Recovery</span>
            <span className="text-xs font-mono text-green-400">{(100 - breakdown.totalPct).toFixed(2)}%</span>
          </div>
        </div>
      </div>
      {/* Caret */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 8,
          height: 8,
        }}
        className="bg-slate-900 border-r border-b border-slate-700"
      />
    </div>,
    document.body,
  ) : null;

  // Clone the child element (must be a single <tr>) and inject ref + mouse handlers
  const child = React.cloneElement(children, {
    ref: (el: Element | null) => { triggerRef.current = el; },
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      place();
      setOpen(true);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      setOpen(false);
    },
  });

  return (
    <>
      {child}
      {panel}
    </>
  );
}
