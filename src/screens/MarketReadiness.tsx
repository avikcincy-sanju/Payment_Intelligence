import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Download, Info } from 'lucide-react';
import { DLOCAL_CORRIDORS, PIPELINE_MARKETS, STRIPE_MARKETS } from '../data/constants';
import { readinessScore } from '../utils/calculations';

// ---------------------------------------------------------------------------
// Score breakdown
// ---------------------------------------------------------------------------

interface ReadinessBreakdown {
  score: number;
  base: number;
  settPenalty: number;
  costPenalty: number;
  fxPenalty: number;
  methodBonus: number;
  fastSettlementBonus: number;
  lowCostBonus: number;
  bestSettlement: number;
  bestAllIn: number;
  bestFx: number;
  methodCount: number;
}

function readinessBreakdown(methods: { processing: number; fx: number; settlement: number }[]): ReadinessBreakdown {
  const best = methods.reduce((b, m) => (m.processing + m.fx < b.processing + b.fx ? m : b));
  const base = 85;
  const allIn = best.processing + best.fx;

  // Settlement penalty
  let settPenalty = 0;
  if (best.settlement > 20) settPenalty = -30;
  else if (best.settlement > 10) settPenalty = -20;
  else if (best.settlement > 5) settPenalty = -10;
  else if (best.settlement <= 3) settPenalty = 0; // fast settlement handled by bonus

  // Cost penalty
  let costPenalty = 0;
  if (allIn > 0.08) costPenalty = -25;
  else if (allIn > 0.06) costPenalty = -18;
  else if (allIn > 0.04) costPenalty = -10;

  // FX penalty
  let fxPenalty = 0;
  if (best.fx >= 0.08) fxPenalty = -25;
  else if (best.fx >= 0.02) fxPenalty = -10;

  // Method count bonus/penalty
  let methodBonus = 0;
  if (methods.length < 2) methodBonus = -8;
  else if (methods.length >= 3) methodBonus = 8;

  // Fast settlement bonus
  const fastSettlementBonus = best.settlement <= 3 ? 5 : 0;

  // Low cost bonus
  const lowCostBonus = best.processing <= 0.02 ? 8 : 0;

  const raw = base + settPenalty + costPenalty + fxPenalty + methodBonus + fastSettlementBonus + lowCostBonus;
  const score = Math.max(0, Math.min(100, raw));

  return {
    score,
    base,
    settPenalty,
    costPenalty,
    fxPenalty,
    methodBonus,
    fastSettlementBonus,
    lowCostBonus,
    bestSettlement: best.settlement,
    bestAllIn: allIn,
    bestFx: best.fx,
    methodCount: methods.length,
  };
}

// ---------------------------------------------------------------------------
// Stripe readiness score
// ---------------------------------------------------------------------------

function stripeReadinessScore(market: { klarna: boolean; adaptive: boolean; settlement_days: number }): number {
  let score = 85;
  if (market.adaptive) score += 5;
  if (market.klarna) score += 5;
  // T+2 settlement is good — fast settlement bonus
  if (market.settlement_days <= 3) score += 5;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Dynamic risk computation
// ---------------------------------------------------------------------------

function computeRisk(methods: { processing: number; fx: number; settlement: number }[]): string | null {
  const best = methods.reduce((b, m) => (m.processing + m.fx < b.processing + b.fx ? m : b));
  const allIn = (best.processing + best.fx) * 100;
  if (allIn > 6) return 'high';
  if (best.settlement > 10) return 'settlement';
  if (best.fx > 0.04) return 'fx';
  return null;
}

// ---------------------------------------------------------------------------
// Activation notes for pipeline
// ---------------------------------------------------------------------------

function activationNote(status: string): string {
  if (status === 'Q4 2026') return 'Contracts in progress';
  if (status === 'TBC') return 'Commercial review pending';
  if (status === 'Not Supported') return 'Alternative PSP required';
  return '';
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportToCSV(
  dlocalCards: ReturnType<typeof buildDLocalCards>,
  stripeCards: ReturnType<typeof buildStripeCards>
) {
  const rows: string[][] = [
    ['PSP', 'Country', 'Region', 'Currency', 'Score', 'Best Settlement (days)', 'Min Cost (%)', 'Risk'],
  ];
  for (const c of dlocalCards) {
    rows.push(['dLocal', c.country, c.region, c.currency, String(c.breakdown.score), String(c.breakdown.bestSettlement), (c.breakdown.bestAllIn * 100).toFixed(2), c.risk ?? '']);
  }
  for (const s of stripeCards) {
    rows.push(['Stripe', s.country, s.region, s.currency, String(s.score), String(s.settlement_days), '~3.9', '']);
  }
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'market-readiness.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Data builders
// ---------------------------------------------------------------------------

function buildDLocalCards() {
  return Object.entries(DLOCAL_CORRIDORS).map(([key, c]) => {
    const breakdown = readinessBreakdown(c.methods);
    const best = c.methods.find(m => m.name === c.recommended) || c.methods[0];
    const risk = computeRisk(c.methods);
    return {
      key,
      breakdown,
      country: c.country,
      region: c.region,
      currency: c.currency,
      flag: c.flag,
      methods: c.methods,
      recommended: c.recommended,
      bestMethod: best.name,
      settlement: best.settlement,
      costPct: (best.processing + best.fx) * 100,
      risk,
    };
  });
}

function buildStripeCards() {
  return Object.entries(STRIPE_MARKETS).map(([key, s]) => ({
    key,
    country: s.country,
    currency: s.currency,
    flag: s.flag,
    region: s.region,
    klarna: s.klarna,
    adaptive: s.adaptive,
    settlement_days: s.settlement_days,
    score: stripeReadinessScore(s),
  }));
}

// ---------------------------------------------------------------------------
// Readiness Ring
// ---------------------------------------------------------------------------

function ReadinessRing({
  score,
  onClick,
}: {
  score: number;
  onClick?: () => void;
}) {
  const radius = 24;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div
      className={`relative w-16 h-16 flex items-center justify-center ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      title={onClick ? 'Click for score breakdown' : undefined}
    >
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#334155" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono font-bold text-sm" style={{ color }}>
        {score}
      </span>
      {onClick && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-600 rounded-full flex items-center justify-center">
          <Info size={9} className="text-slate-300" />
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Breakdown Tooltip
// ---------------------------------------------------------------------------

function ScoreBreakdownTooltip({
  breakdown,
  onClose,
}: {
  breakdown: ReadinessBreakdown;
  onClose: () => void;
}) {
  const rows: { label: string; value: number; note: string }[] = [
    { label: 'Base score', value: breakdown.base, note: '' },
    {
      label: 'Settlement',
      value: breakdown.settPenalty,
      note: `T+${breakdown.bestSettlement}`,
    },
    {
      label: 'Cost (all-in)',
      value: breakdown.costPenalty,
      note: `${(breakdown.bestAllIn * 100).toFixed(2)}%`,
    },
    {
      label: 'FX exposure',
      value: breakdown.fxPenalty,
      note: `${(breakdown.bestFx * 100).toFixed(2)}% FX`,
    },
    {
      label: 'Method count',
      value: breakdown.methodBonus,
      note: `${breakdown.methodCount} method${breakdown.methodCount !== 1 ? 's' : ''}`,
    },
    {
      label: 'Fast settlement',
      value: breakdown.fastSettlementBonus,
      note: breakdown.fastSettlementBonus > 0 ? '≤ T+3 bonus' : 'n/a',
    },
    {
      label: 'Low-cost rail',
      value: breakdown.lowCostBonus,
      note: breakdown.lowCostBonus > 0 ? '≤ 2% processing' : 'n/a',
    },
  ];

  const color = breakdown.score >= 70 ? 'text-green-400' : breakdown.score >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div
      className="absolute right-0 top-16 z-50 w-64 bg-slate-900 border border-slate-600 rounded-lg shadow-xl p-4"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-slate-400">Score Breakdown</span>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-xs leading-none"
        >
          ✕
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{r.label}</span>
            <div className="flex items-center gap-2">
              {r.note && <span className="text-slate-500">{r.note}</span>}
              <span
                className={
                  r.value > 0
                    ? 'text-green-400 font-mono'
                    : r.value < 0
                    ? 'text-red-400 font-mono'
                    : 'text-slate-400 font-mono'
                }
              >
                {r.value > 0 ? `+${r.value}` : r.value}
              </span>
            </div>
          </div>
        ))}
        <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-300 font-semibold">Final score</span>
          <span className={`font-mono font-bold text-sm ${color}`}>{breakdown.score}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'Q4 2026')
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/30">
        Q4 2026
      </span>
    );
  if (status === 'TBC')
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30">
        TBC
      </span>
    );
  if (status === 'Not Supported')
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
        <span>✕</span>Not Supported
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/30">
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort toggle button
// ---------------------------------------------------------------------------

type SortDir = 'desc' | 'asc';

function SortToggle({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
    >
      Sort by score
      {dir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      <span className="text-slate-500 ml-0.5">{dir === 'desc' ? 'High→Low' : 'Low→High'}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MarketReadiness() {
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const allDLocalCards = useMemo(() => buildDLocalCards(), []);
  const allStripeCards = useMemo(() => buildStripeCards(), []);

  const dlocalCards = useMemo(
    () =>
      [...allDLocalCards].sort((a, b) =>
        sortDir === 'desc'
          ? b.breakdown.score - a.breakdown.score
          : a.breakdown.score - b.breakdown.score
      ),
    [allDLocalCards, sortDir]
  );

  const stripeCards = useMemo(
    () =>
      [...allStripeCards].sort((a, b) =>
        sortDir === 'desc' ? b.score - a.score : a.score - b.score
      ),
    [allStripeCards, sortDir]
  );

  // Dynamic coverage gap counts
  const gapCounts = useMemo(() => {
    const notSupported = PIPELINE_MARKETS.filter(m => m.status === 'Not Supported');
    const q4 = PIPELINE_MARKETS.filter(m => m.status === 'Q4 2026');
    const tbc = PIPELINE_MARKETS.filter(m => m.status === 'TBC');
    return { notSupported, q4, tbc };
  }, []);

  const handleToggleTooltip = (key: string) => {
    setOpenTooltip(prev => (prev === key ? null : key));
  };

  const handleOverlayClick = () => setOpenTooltip(null);

  return (
    <div className="space-y-8" onClick={openTooltip ? handleOverlayClick : undefined}>
      {/* Header with sort + export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Market Readiness</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Payment feasibility scored across active corridors and pipeline markets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SortToggle dir={sortDir} onToggle={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))} />
          <button
            onClick={() => exportToCSV(allDLocalCards, allStripeCards)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active dLocal grid                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Active dLocal Corridors — Readiness Grid</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click the readiness ring to see the score breakdown
            </p>
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" /> &gt;70 Ready
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> 40–70 Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> &lt;40 Review
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dlocalCards.map(c => (
            <div
              key={c.key}
              className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xl mb-1">{c.flag}</div>
                  <div className="font-semibold text-white">{c.country}</div>
                  <div className="flex gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">
                      {c.region}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/10 text-sky-400">
                      {c.currency}
                    </span>
                  </div>
                </div>
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <ReadinessRing
                    score={c.breakdown.score}
                    onClick={() => handleToggleTooltip(c.key)}
                  />
                  {openTooltip === c.key && (
                    <ScoreBreakdownTooltip
                      breakdown={c.breakdown}
                      onClose={() => setOpenTooltip(null)}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 mb-0.5">Best Method</div>
                  <div className="text-white font-medium truncate">{c.bestMethod}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Settlement</div>
                  <div
                    className={`font-mono font-semibold ${
                      c.settlement > 10 ? 'text-amber-400' : 'text-white'
                    }`}
                  >
                    T+{c.settlement}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Min Cost</div>
                  <div
                    className={`font-mono font-semibold ${
                      c.costPct > 6 ? 'text-red-400' : 'text-white'
                    }`}
                  >
                    {c.costPct.toFixed(2)}%
                  </div>
                </div>
              </div>

              {c.risk && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  {c.risk === 'high' && (
                    <span className="text-xs text-red-400">
                      ⚠ High cost corridor — review payment method defaults
                    </span>
                  )}
                  {c.risk === 'settlement' && (
                    <span className="text-xs text-amber-400">
                      ⚠ Long settlement window — factor into cashflow planning
                    </span>
                  )}
                  {c.risk === 'fx' && (
                    <span className="text-xs text-orange-400">
                      ⚠ Elevated FX exposure — monitor currency movements
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stripe markets grid                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Stripe Markets — Readiness Grid</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Baseline 85 · +5 Adaptive Pricing · +5 Klarna · +5 T+2 settlement
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stripeCards.map(s => (
            <div
              key={s.key}
              className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xl mb-1">{s.flag}</div>
                  <div className="font-semibold text-white">{s.country}</div>
                  <div className="flex gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">
                      {s.region}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/10 text-sky-400">
                      {s.currency}
                    </span>
                  </div>
                </div>
                <ReadinessRing score={s.score} />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 mb-0.5">Settlement</div>
                  <div className="text-white font-mono font-semibold">T+{s.settlement_days}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Adaptive</div>
                  <div className={s.adaptive ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                    {s.adaptive ? 'Yes' : 'No'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Klarna</div>
                  <div className={s.klarna ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                    {s.klarna ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pipeline table                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Pipeline Markets</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Markets pending activation, commercial review, or PSP support evaluation
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    Market
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    Region
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    PSP
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    Currency
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    Readiness
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">
                    Activation Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {PIPELINE_MARKETS.map(m => (
                  <tr
                    key={m.country}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-white">
                      <span className="mr-2">{m.flag}</span>{m.country}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{m.region}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          m.psp === 'None'
                            ? 'bg-slate-700 text-slate-500'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {m.psp}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">{m.currency}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              m.readiness >= 70
                                ? 'bg-green-500'
                                : m.readiness >= 40
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${m.readiness}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-400">{m.readiness}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs ${
                          m.status === 'Not Supported'
                            ? 'text-red-400'
                            : m.status === 'TBC'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                        }`}
                      >
                        {activationNote(m.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Coverage Gap Analysis (dynamic)                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-slate-800 border border-l-4 border-slate-700 border-l-teal-500 rounded-lg p-5">
        <div className="text-xs uppercase tracking-widest text-teal-400 mb-4">Coverage Gap Analysis</div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
            <span className="text-sm text-slate-300">
              {gapCounts.notSupported.length} market
              {gapCounts.notSupported.length !== 1 ? 's' : ''} currently unsupported by dLocal:{' '}
              {gapCounts.notSupported.map(m => m.country).join(', ')} — alternative PSP evaluation
              recommended
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0 mt-1.5" />
            <span className="text-sm text-slate-300">
              {gapCounts.q4.length} market{gapCounts.q4.length !== 1 ? 's' : ''} confirmed for Q4 2026
              onboarding: {gapCounts.q4.map(m => m.country).join(', ')} — commercial contracts in
              progress
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
            <span className="text-sm text-slate-300">
              {gapCounts.tbc.length} market{gapCounts.tbc.length !== 1 ? 's' : ''} in TBC status
              pending dLocal commercial confirmation:{' '}
              {gapCounts.tbc.map(m => m.country).join(', ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
