import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Download, Table, LayoutGrid } from 'lucide-react';
import { DLOCAL_CORRIDORS, STRIPE_MARKETS, PSP_CONFIG } from '../data/constants';
import { calculateCost, fmt, fmtPct } from '../utils/calculations';
import { useAssumptions } from '../context/AssumptionsContext';
import InfoTooltip from '../components/InfoTooltip';
import CostBreakdownHover from '../components/CostBreakdownHover';

interface Props {
  fxRates: Record<string, number>;
  fxTimestamp: string;
}

// Cost composition colours — shared across all uses in this file
const COST_COLORS = {
  processing: '#0ea5e9',
  fx:         '#f59e0b',
  float:      '#3b82f6',
  platform:   '#64748b',
};

// Risk-type metadata for the alert banner
const RISK_META: Record<string, { label: string; action: string; severity: 'red' | 'amber' }> = {
  high:       { label: 'High All-In Cost',           action: 'Review cost recovery and pricing strategy with Treasury before activating this corridor.', severity: 'red' },
  fx:         { label: 'Elevated FX Exposure',       action: 'Review FX hedging strategy with Treasury before activating. Consider locking rates on large volumes.', severity: 'red' },
  settlement: { label: 'Extended Settlement Window', action: 'Treasury float planning is required. Model the capital cost of funds in transit.', severity: 'amber' },
};

export default function PSPComparison({ fxTimestamp }: Props) {
  const [selectedKey, setSelectedKey]                   = useState('uk');
  const [amount, setAmount]                             = useState(500);
  const [annualVolume, setAnnualVolume]                 = useState(1000);
  const [adaptivePricingEnabled, setAdaptivePricingEnabled] = useState(false);
  const [adaptiveUplift, setAdaptiveUplift]             = useState(8);
  const [klarnaUplift, setKlarnaUplift]                 = useState(12);
  const [showCostComposition, setShowCostComposition]   = useState(false);
  const [compareAllMethods, setCompareAllMethods]       = useState(false);
  const { assumptions } = useAssumptions();

  const corridor    = DLOCAL_CORRIDORS[selectedKey];
  const stripeMarket = STRIPE_MARKETS[selectedKey];

  const overrides = {
    floatCostAnnualPct: assumptions.settlement.floatCostPct,
    platformFeePct:     assumptions.platform.platformFeePct,
  };

  // ── Cards / methods ───────────────────────────────────────────────────────
  const cards = useMemo(() => {
    if (corridor) {
      return corridor.methods.map(m => {
        const cost = calculateCost(amount, m.processing, 0, m.fx, m.settlement, 0.01, overrides);
        return {
          id: m.name, label: m.name, psp: 'dLocal',
          totalPct: cost.totalPct, totalCost: cost.totalCost, netReceived: cost.netReceived,
          settlement: m.settlement, isRec: m.name === corridor.recommended,
          bnpl: m.bnpl || false, processingPct: m.processing, fxPct: m.fx, breakdown: cost,
        };
      });
    }
    if (stripeMarket) {
      const fxStd = assumptions.fxSpreads.stripeStandard / 100;
      const fxAdp = assumptions.fxSpreads.stripeAdaptive / 100;
      const fxKlr = assumptions.fxSpreads.klarna       / 100;
      const result = [];
      const stdCost = calculateCost(amount, PSP_CONFIG.stripe_standard.processing_pct, PSP_CONFIG.stripe_standard.processing_flat, fxStd, stripeMarket.settlement_days, 0.01, overrides);
      result.push({ id: 'standard', label: 'Stripe Standard', psp: 'Stripe', totalPct: stdCost.totalPct, totalCost: stdCost.totalCost, netReceived: stdCost.netReceived, settlement: stripeMarket.settlement_days, isRec: !stripeMarket.adaptive, bnpl: false, processingPct: PSP_CONFIG.stripe_standard.processing_pct, fxPct: fxStd, breakdown: stdCost });
      if (stripeMarket.adaptive) {
        const apCost = calculateCost(amount, PSP_CONFIG.stripe_adaptive.processing_pct, PSP_CONFIG.stripe_adaptive.processing_flat, fxAdp, stripeMarket.settlement_days, 0.01, overrides);
        result.push({ id: 'adaptive', label: 'Adaptive Pricing', psp: 'Stripe', totalPct: apCost.totalPct, totalCost: apCost.totalCost, netReceived: apCost.netReceived, settlement: stripeMarket.settlement_days, isRec: true, bnpl: false, processingPct: PSP_CONFIG.stripe_adaptive.processing_pct, fxPct: fxAdp, breakdown: apCost });
      }
      if (stripeMarket.klarna) {
        const kCost = calculateCost(amount, PSP_CONFIG.klarna.processing_pct, PSP_CONFIG.klarna.processing_flat, fxKlr, PSP_CONFIG.klarna.settlement_days, 0.01, overrides);
        result.push({ id: 'klarna', label: 'Klarna (BNPL)', psp: 'Stripe', totalPct: kCost.totalPct, totalCost: kCost.totalCost, netReceived: kCost.netReceived, settlement: PSP_CONFIG.klarna.settlement_days, isRec: false, bnpl: true, processingPct: PSP_CONFIG.klarna.processing_pct, fxPct: fxKlr, breakdown: kCost });
      }
      return result;
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, amount, corridor, stripeMarket, assumptions]);

  // ── Derived values ────────────────────────────────────────────────────────
  const cheapest      = cards.length > 0 ? cards.reduce((b, c) => c.totalCost < b.totalCost ? c : b) : null;
  const mostExpensive = cards.length > 0 ? cards.reduce((b, c) => c.totalCost > b.totalCost ? c : b) : null;
  const klarnaCard    = cards.find(c => c.id === 'klarna');
  const stdCard       = cards.find(c => c.id === 'standard');
  const apCard        = cards.find(c => c.id === 'adaptive');

  const isDLocal    = !!corridor;
  const screenTitle = isDLocal ? 'Payment Method Optimization' : 'PSP Comparison Engine';

  // ── Risk alert ────────────────────────────────────────────────────────────
  const riskKey   = corridor?.risk as string | undefined;
  const riskMeta  = riskKey ? RISK_META[riskKey] : null;

  // ── Executive summary (dynamic) ──────────────────────────────────────────
  const savingPerReg   = cheapest && mostExpensive && cheapest.id !== mostExpensive.id
    ? mostExpensive.totalCost - cheapest.totalCost : 0;
  const annualSaving   = savingPerReg * annualVolume;

  const executiveSummary = useMemo(() => {
    if (!cheapest || cards.length < 2) return null;
    const lines: string[] = [];

    // 1. Cheapest method headline
    lines.push(
      `Cheapest method: ${cheapest.label} at ${fmtPct(cheapest.totalPct)} — saves $${fmt(savingPerReg)} per registration vs most expensive (${mostExpensive?.label ?? '—'}).`
    );

    // 2. Local rail vs cards
    if (isDLocal && corridor) {
      const bankRails = cards.filter(c => /pix|transfer|bank|virtual|upi|spei/i.test(c.label));
      const cardRails = cards.filter(c => /card|credit|debit/i.test(c.label));
      if (bankRails.length > 0 && cardRails.length > 0) {
        const cheapestRail = bankRails.reduce((b, c) => c.totalCost < b.totalCost ? c : b);
        const cheapestCard = cardRails.reduce((b, c) => c.totalCost < b.totalCost ? c : b);
        if (cheapestCard.totalCost > 0) {
          const multiple = cheapestCard.totalCost / Math.max(cheapestRail.totalCost, 0.01);
          lines.push(
            `Local rail (${cheapestRail.label}) is ${multiple.toFixed(1)}x cheaper than cards (${cheapestCard.label}) — prioritise local bank-rail for cost and chargeback reduction.`
          );
        }
      }
    }

    // 3. Adaptive Pricing FX saving
    if (apCard && stdCard) {
      const fxSavingPct = stdCard.fxPct > 0
        ? ((stdCard.fxPct - apCard.fxPct) / stdCard.fxPct) * 100
        : 0;
      lines.push(
        `Adaptive Pricing reduces FX cost by ${fxSavingPct.toFixed(0)}% vs Standard (spread: ${fmtPct(apCard.fxPct * 100)} vs ${fmtPct(stdCard.fxPct * 100)}), saving $${fmt(stdCard.totalCost - apCard.totalCost)} per registration.`
      );
    }

    // 4. Klarna note
    if (klarnaCard && cheapest.id !== 'klarna') {
      lines.push(`Klarna should be evaluated only where conversion uplift offsets its higher processing cost.`);
    }

    // 5. Fastest settlement (dLocal only)
    if (isDLocal) {
      const fastest = cards.reduce((b, c) => c.settlement < b.settlement ? c : b);
      if (fastest.id !== cheapest.id) {
        lines.push(`${fastest.label} offers the fastest settlement at T+${fastest.settlement}, reducing float exposure for rapid treasury repatriation.`);
      }
    }

    return lines;
  }, [cheapest, mostExpensive, cards, klarnaCard, apCard, stdCard, isDLocal, corridor, savingPerReg]);

  // ── Adaptive / Klarna simulators ──────────────────────────────────────────
  const apFxSaving          = apCard && stdCard ? (stdCard.totalCost - apCard.totalCost) : 0;
  const apUpliftRevenue     = amount * (adaptiveUplift / 100);
  const apNetImpactPer1000  = (apUpliftRevenue + apFxSaving) * 1000;

  const klarnaExtraCost       = klarnaCard && stdCard ? (klarnaCard.totalCost - stdCard.totalCost) : 0;
  const klarnaBreakEven       = klarnaExtraCost > 0 ? (klarnaExtraCost / (klarnaUplift / 100)) : 0;
  const klarnaNetRevenuePer1000 = klarnaCard ? ((amount * (klarnaUplift / 100) - klarnaExtraCost) * 1000) : 0;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = cards.map(c => ({
    name:  c.label.length > 18 ? c.label.slice(0, 17) + '…' : c.label,
    pct:   parseFloat(c.totalPct.toFixed(2)),
    id:    c.id,
    fill:  c.id === cheapest?.id ? '#22c55e' : c.bnpl ? '#a855f7' : '#475569',
  }));

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (cards.length === 0) return;
    const best = cheapest;
    const header = ['Method', 'PSP', 'Processing %', 'FX Fee %', 'Settlement (days)', 'All-In %', 'Total Cost ($)', 'Net Received ($)', 'vs Best (savings %)'];
    const rows = cards.map(c => {
      const vsBest = best && c.id !== best.id ? (((c.totalCost - best.totalCost) / best.totalCost) * 100).toFixed(2) + '%' : '—';
      return [
        c.label,
        c.psp,
        (c.processingPct * 100).toFixed(2) + '%',
        (c.fxPct * 100).toFixed(2) + '%',
        'T+' + c.settlement,
        c.totalPct.toFixed(2) + '%',
        fmt(c.totalCost),
        fmt(c.netReceived),
        vsBest,
      ];
    });
    const marketLabel = corridor?.country ?? stripeMarket?.country ?? selectedKey;
    const meta = [
      [`Market: ${marketLabel}`],
      [`Registration Value: $${amount}`],
      [`Annual Volume: ${annualVolume}`],
      [`Potential Annual Saving vs Worst: $${fmt(annualSaving)}`],
      [],
    ];
    const csvContent = [
      ...meta.map(r => r.join(',')),
      header.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `psp-comparison-${selectedKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cards, cheapest, corridor, stripeMarket, selectedKey, amount, annualVolume, annualSaving]);

  // ── Cost composition bar for a single card ───────────────────────────────
  const CostCompositionBar = ({ card }: { card: typeof cards[0] }) => {
    if (!card.breakdown) return null;
    const total = card.totalCost;
    const segments = [
      { key: 'processing', value: card.breakdown.processingCost,                                        color: COST_COLORS.processing },
      { key: 'fx',         value: card.breakdown.fxCost,                                                color: COST_COLORS.fx },
      { key: 'float',      value: card.breakdown.floatCost,                                             color: COST_COLORS.float },
      { key: 'platform',   value: card.breakdown.platformCost + card.breakdown.additionalFixed,         color: COST_COLORS.platform },
    ].filter(s => s.value > 0.0001);
    return (
      <div className="mt-3">
        <div className="flex h-2 rounded overflow-hidden w-full" style={{ gap: '1px' }}>
          {segments.map(seg => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            return pct > 0.5
              ? <div key={seg.key} className="h-full" style={{ width: `${pct}%`, backgroundColor: seg.color, opacity: 0.85 }} />
              : null;
          })}
        </div>
        <div className="flex gap-2.5 mt-1.5 flex-wrap">
          {[
            { label: 'Processing', color: COST_COLORS.processing, value: card.breakdown.processingCost },
            { label: 'FX',         color: COST_COLORS.fx,         value: card.breakdown.fxCost },
            { label: 'Float',      color: COST_COLORS.float,      value: card.breakdown.floatCost },
            { label: 'Platform',   color: COST_COLORS.platform,   value: card.breakdown.platformCost + card.breakdown.additionalFixed },
          ].filter(s => s.value > 0.0001).map(s => (
            <span key={s.label} className="flex items-center gap-1 text-xs text-slate-500">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: s.color, opacity: 0.85 }} />
              {s.label}: {amount > 0 ? ((s.value / amount) * 100).toFixed(2) : '0.00'}%
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Dynamic screen title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">{screenTitle}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isDLocal
              ? `Comparing ${corridor?.methods.length ?? 0} local payment methods for ${corridor?.country}`
              : `Stripe payment options for ${stripeMarket?.country ?? 'selected market'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDLocal && corridor && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">dLocal Corridor</span>
          )}
          {!isDLocal && stripeMarket && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-400 border border-slate-600 font-medium">Stripe Market</span>
          )}
          {cards.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 transition-colors"
              title="Export comparison as CSV"
            >
              <Download size={12} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── High-Risk Corridor Alert ─────────────────────────────────────── */}
      {riskMeta && (
        <div className={`flex items-start gap-3 border border-l-4 rounded-lg px-4 py-3 ${
          riskMeta.severity === 'red'
            ? 'bg-red-500/5 border-red-500/25 border-l-red-500'
            : 'bg-amber-500/5 border-amber-500/25 border-l-amber-500'
        }`}>
          <AlertTriangle
            size={15}
            className={`flex-shrink-0 mt-0.5 ${riskMeta.severity === 'red' ? 'text-red-400' : 'text-amber-400'}`}
          />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs font-semibold uppercase tracking-widest ${riskMeta.severity === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                Risk Flag
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                riskMeta.severity === 'red'
                  ? 'bg-red-500/15 text-red-300 border border-red-500/25'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
              }`}>
                {riskMeta.label}
              </span>
            </div>
            <p className={`text-sm mt-0.5 ${riskMeta.severity === 'red' ? 'text-red-300/80' : 'text-amber-300/80'}`}>
              {riskMeta.action}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Market</label>
            <select
              value={selectedKey}
              onChange={e => setSelectedKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              <optgroup label="dLocal Corridors">
                {Object.entries(DLOCAL_CORRIDORS).map(([k, v]) => (
                  <option key={k} value={k}>{v.flag} {v.country}</option>
                ))}
              </optgroup>
              <optgroup label="Stripe Markets">
                {Object.entries(STRIPE_MARKETS).map(([k, v]) => (
                  <option key={k} value={k}>{v.flag} {v.country}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="w-40">
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Registration Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="number"
                min={50}
                max={5000}
                value={amount}
                onChange={e => setAmount(Math.max(50, Math.min(5000, Number(e.target.value))))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          <div className="w-44">
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Annual Registrations</label>
            <div className="relative">
              <input
                type="number"
                min={100}
                max={1000000}
                step={100}
                value={annualVolume}
                onChange={e => setAnnualVolume(Math.max(100, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Compare All Methods toggle */}
          {cards.length > 1 && (
            <div className="flex items-end gap-2 pb-0.5">
              <button
                onClick={() => setCompareAllMethods(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border transition-colors ${
                  compareAllMethods
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-300'
                }`}
              >
                {compareAllMethods ? <Table size={12} /> : <LayoutGrid size={12} />}
                {compareAllMethods ? 'Table View' : 'Compare All'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* No PSP available */}
      {cards.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-5 py-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 mb-3">
            <AlertTriangle size={18} className="text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-slate-300 mb-1">PSP Unavailable</div>
          <p className="text-xs text-slate-500">No active payment provider is configured for this market. Select a different market or review the pipeline in the Market Readiness screen.</p>
        </div>
      )}

      {/* ── Compare All Methods — Table View ─────────────────────────────── */}
      {compareAllMethods && cards.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-400">All Methods — Side-by-Side</span>
            <span className="text-xs text-slate-500">{cards.length} methods · registration value ${amount}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Method', 'Processing', 'FX Fee', 'Settlement', 'All-In %', 'Net Received', 'vs Best'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.map((c, idx) => {
                  const isBest    = c.id === cheapest?.id;
                  const isWorst   = c.id === mostExpensive?.id && cards.length > 1;
                  const savingsPct = cheapest && c.id !== cheapest.id && cheapest.totalCost > 0
                    ? ((c.totalCost - cheapest.totalCost) / cheapest.totalCost) * 100
                    : null;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-700/50 transition-colors hover:bg-slate-700/20 ${isBest ? 'bg-green-500/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{c.label}</span>
                          {isBest  && <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25">Best</span>}
                          {isWorst && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Highest</span>}
                          {c.bnpl  && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/25">BNPL</span>}
                        </div>
                        {/* Cost composition bar */}
                        <div className="mt-2">
                          <div className="flex h-1.5 rounded overflow-hidden w-full max-w-xs" style={{ gap: '1px' }}>
                            {[
                              { key: 'p', v: c.breakdown?.processingCost ?? 0,                                          color: COST_COLORS.processing },
                              { key: 'f', v: c.breakdown?.fxCost ?? 0,                                                  color: COST_COLORS.fx },
                              { key: 'l', v: c.breakdown?.floatCost ?? 0,                                               color: COST_COLORS.float },
                              { key: 'g', v: (c.breakdown?.platformCost ?? 0) + (c.breakdown?.additionalFixed ?? 0),    color: COST_COLORS.platform },
                            ].map(seg => {
                              const pct = c.totalCost > 0 ? (seg.v / c.totalCost) * 100 : 0;
                              return pct > 0.5 ? <div key={seg.key} className="h-full" style={{ width: `${pct}%`, backgroundColor: seg.color, opacity: 0.8 }} /> : null;
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">{fmtPct(c.processingPct * 100)}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span className={c.fxPct > 0.04 ? 'text-orange-400 font-semibold' : 'text-slate-300'}>
                          {fmtPct(c.fxPct * 100)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span className={c.settlement > 7 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                          T+{c.settlement}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span className={`font-bold ${c.totalPct > 6 ? 'text-red-400' : isBest ? 'text-green-400' : 'text-white'}`}>
                          {fmtPct(c.totalPct)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-green-400 whitespace-nowrap">${fmt(c.netReceived)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isBest ? (
                          <span className="text-xs text-green-400 font-medium">—</span>
                        ) : savingsPct !== null ? (
                          <span className="text-xs font-mono text-red-400">+{savingsPct.toFixed(1)}% more</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-slate-700/50 flex gap-4">
            {[
              { label: 'Processing', color: COST_COLORS.processing },
              { label: 'FX',         color: COST_COLORS.fx },
              { label: 'Float',      color: COST_COLORS.float },
              { label: 'Platform',   color: COST_COLORS.platform },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: s.color, opacity: 0.8 }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Card View (default) ──────────────────────────────────────────── */}
      {!compareAllMethods && (
        <div className={`grid gap-4 ${cards.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : cards.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
          {cards.map(c => {
            const isCheapest  = c.id === cheapest?.id;
            const fxOutlier   = c.fxPct > 0.04;
            const settlOutlier = c.settlement > 7;
            return (
              <CostBreakdownHover key={c.id} breakdown={c.breakdown} amount={amount}>
                <div
                  className={`bg-slate-800 rounded-lg p-5 border transition-colors h-full flex flex-col ${
                    isCheapest ? 'border-green-500/40' : 'border-slate-700'
                  } ${c.isRec ? 'border-l-4 border-l-green-500' : c.bnpl ? 'border-l-4 border-l-teal-500' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4 gap-2">
                    <div>
                      <div className="font-semibold text-white text-sm">{c.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.psp}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {c.isRec && <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/30">✓ Recommended</span>}
                      {c.bnpl && (
                        <InfoTooltip
                          content={<p className="text-slate-300">BNPL method. Refunds are processed as per BNPL provider rules — typically longer refund windows and provider-managed dispute handling.</p>}
                          width={260}
                        >
                          <span className="px-2 py-0.5 rounded-full text-xs bg-teal-500/15 text-teal-400 border border-teal-500/30 cursor-help">BNPL</span>
                        </InfoTooltip>
                      )}
                      {isCheapest && !c.isRec && <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/30">Lowest Cost</span>}
                    </div>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {/* All-In Cost */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">All-In Cost</span>
                        <span className={`font-mono font-bold text-xl ${c.totalPct > 6 ? 'text-red-400' : isCheapest ? 'text-green-400' : 'text-white'}`}>
                          {fmtPct(c.totalPct)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Total Cost ($)</span>
                      <span className="font-mono text-sm text-white">${fmt(c.totalCost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Net Received</span>
                      <span className="font-mono text-sm font-semibold text-green-400">${fmt(c.netReceived)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Settlement</span>
                      <div className="flex items-center gap-1">
                        <span className={`font-mono text-sm ${settlOutlier ? 'text-amber-400 font-semibold' : 'text-white'}`}>T+{c.settlement}</span>
                        {settlOutlier && (
                          <InfoTooltip
                            content={<p className="text-slate-300">Settlement exceeds T+7 — extended float exposure. Treasury planning recommended.</p>}
                            width={220}
                          />
                        )}
                      </div>
                    </div>
                    {fxOutlier && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">FX Fee</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm text-orange-400 font-semibold">{fmtPct(c.fxPct * 100)}</span>
                          <InfoTooltip
                            content={<p className="text-slate-300">FX fee exceeds 4% — high conversion cost. Review with Treasury before activating this rail.</p>}
                            width={220}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Side-by-side cost composition bar */}
                  <CostCompositionBar card={c} />

                  {/* Outlier badges */}
                  {(fxOutlier || settlOutlier) && (
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                      {fxOutlier   && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20"><AlertTriangle size={9} /> High FX</span>}
                      {settlOutlier && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20"><AlertTriangle size={9} /> Long Settlement</span>}
                    </div>
                  )}

                  {/* Hover hint */}
                  <div className="mt-3 pt-2.5 border-t border-slate-700/50">
                    <p className="text-xs text-slate-700">Hover to see full breakdown</p>
                  </div>
                </div>
              </CostBreakdownHover>
            );
          })}
        </div>
      )}

      {/* ── Executive Summary ────────────────────────────────────────────── */}
      {executiveSummary && cheapest && cards.length >= 2 && (
        <div className="bg-slate-800 border border-slate-700 border-l-4 border-l-teal-500 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-teal-400 mb-1">{isDLocal ? 'Optimization Recommendation' : 'Recommended Outcome'}</div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Recommended:</span>
                <span className="font-semibold text-white">{cheapest.label}</span>
                <span className="font-mono text-green-400 font-bold">{fmtPct(cheapest.totalPct)}</span>
              </div>
              <div className="space-y-2">
                {executiveSummary.map((line, i) => (
                  <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Net received</div>
                <div className="text-2xl font-mono font-bold text-green-400">${fmt(cheapest.netReceived)}</div>
                <div className="text-xs text-slate-500 mt-0.5">per registration</div>
              </div>
              {annualSaving > 0 && mostExpensive && cheapest.id !== mostExpensive.id && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <div className="text-xs text-slate-400 mb-0.5">Potential Annual Saving</div>
                  <div className="text-lg font-mono font-bold text-green-400">${annualSaving.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                  <div className="text-xs text-slate-500 mt-0.5">vs worst · {annualVolume.toLocaleString()} regs/yr</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cost Composition Detail (collapsible, cheapest method) ────────── */}
      {cheapest && cheapest.breakdown && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowCostComposition(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700/20 transition-colors"
          >
            <span className="text-xs text-slate-400 font-medium">
              View Cost Composition — <span className="text-slate-300">{cheapest.label}</span>
            </span>
            {showCostComposition ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
          </button>
          {showCostComposition && (
            <div className="border-t border-slate-700 px-5 py-4">
              <div className="space-y-1.5 mb-3">
                {[
                  { label: 'Processing Fees',    value: cheapest.breakdown.processingCost, color: COST_COLORS.processing },
                  { label: 'FX Costs',           value: cheapest.breakdown.fxCost,         color: COST_COLORS.fx },
                  { label: 'Settlement Float',   value: cheapest.breakdown.floatCost,      color: COST_COLORS.float },
                  { label: 'Operational Buffer', value: cheapest.breakdown.platformCost + cheapest.breakdown.additionalFixed, color: COST_COLORS.platform },
                ].map(row => {
                  const pct = (row.value / amount) * 100;
                  return (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-xs text-slate-400 flex-1">{row.label}</span>
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 10)}%`, backgroundColor: row.color, opacity: 0.7 }} />
                      </div>
                      <span className="text-xs font-mono text-slate-300 w-12 text-right">{pct.toFixed(2)}%</span>
                    </div>
                  );
                })}
                <div className="border-t border-slate-700/60 pt-1.5 flex items-center gap-3">
                  <span className="w-2 h-2 flex-shrink-0" />
                  <span className="text-xs font-semibold text-white flex-1">Total All-In Cost</span>
                  <div className="flex-1" />
                  <span className="text-xs font-mono font-bold text-white w-12 text-right">{fmtPct(cheapest.totalPct)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0 bg-green-500" />
                  <span className="text-xs font-semibold text-green-400 flex-1">Net Recovery</span>
                  <div className="flex-1" />
                  <span className="text-xs font-mono font-bold text-green-400 w-12 text-right">{(100 - cheapest.totalPct).toFixed(2)}%</span>
                </div>
              </div>
              <p className="text-xs text-slate-600">Indicative modelled assumptions used for corridor comparison.</p>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-5">All-In Cost Comparison</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={36} barGap={8}>
              <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="0" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
                width={40}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                itemStyle={{ color: '#94a3b8' }}
                formatter={(v) => [`${(v as number).toFixed(2)}%`, 'All-In Cost']}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Adaptive Pricing Simulator */}
      {stripeMarket?.adaptive && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-sm font-semibold text-white">Adaptive Pricing Simulator</div>
              <div className="text-xs text-slate-500 mt-0.5">FX spread reduction: 1.5% → 0.4% (contracted rate)</div>
            </div>
            <button
              onClick={() => setAdaptivePricingEnabled(!adaptivePricingEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${adaptivePricingEnabled ? 'bg-sky-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${adaptivePricingEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {adaptivePricingEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-widest text-slate-400">Conversion Uplift Assumption</label>
                  <span className="font-mono text-sky-400 font-semibold">{adaptiveUplift}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={adaptiveUplift}
                  onChange={e => setAdaptiveUplift(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1"><span>1%</span><span>20%</span></div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">FX spread reduction</span>
                  <span className="font-mono text-green-400 text-sm">${fmt(apFxSaving)} per registration</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Conversion uplift revenue ({adaptiveUplift}%)</span>
                  <span className="font-mono text-green-400 text-sm">${fmt(apUpliftRevenue)} per registration</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                  <span className="text-xs font-semibold text-white">Net impact / 1,000 registrations</span>
                  <span className="font-mono text-green-400 font-bold text-lg">${apNetImpactPer1000.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Klarna Simulator */}
      {stripeMarket?.klarna && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="mb-5">
            <div className="text-sm font-semibold text-white">Klarna BNPL Simulator</div>
            <div className="text-xs text-slate-500 mt-0.5">3.49% + $0.49 per transaction · T+1 settlement</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-widest text-slate-400">Conversion Uplift %</label>
                <span className="font-mono text-purple-400 font-semibold">{klarnaUplift}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={25}
                value={klarnaUplift}
                onChange={e => setKlarnaUplift(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>5%</span><span>25%</span></div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Extra cost vs Standard</span>
                <span className="font-mono text-amber-400 text-sm">${fmt(Math.max(0, klarnaExtraCost))} per registration</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Break-even uplift value</span>
                <span className="font-mono text-white text-sm">${fmt(klarnaBreakEven)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                <span className="text-xs font-semibold text-white">Net revenue / 1,000 registrations</span>
                <span className={`font-mono font-bold text-lg ${klarnaNetRevenuePer1000 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {klarnaNetRevenuePer1000 >= 0 ? '+' : ''}{klarnaNetRevenuePer1000.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {fxTimestamp && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <RefreshCw size={10} />
          <span>FX rates as of {fxTimestamp} · ECB/Frankfurter API</span>
          <InfoTooltip
            content={
              <>
                <p className="text-slate-200 font-medium mb-1">Display Currency</p>
                <p className="text-slate-400">Switching display currency does not affect underlying calculations — display only. All cost modelling is performed in USD.</p>
                <div className="border-t border-slate-700/60 pt-2 mt-2 space-y-1 text-slate-500">
                  <div><span className="text-slate-400">FX Source:</span> ECB / Frankfurter API</div>
                  <div><span className="text-slate-400">Last Updated:</span> {fxTimestamp}</div>
                </div>
              </>
            }
            width={280}
          />
        </div>
      )}
    </div>
  );
}
