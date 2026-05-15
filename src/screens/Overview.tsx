import React, { useState, useMemo } from 'react';
import { Search, TrendingUp, Clock, AlertTriangle, CreditCard, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { DLOCAL_CORRIDORS, STRIPE_MARKETS, PIPELINE_MARKETS, BNPL_MARKETS, PORTFOLIO_ALERTS } from '../data/constants';
import { calculateCost } from '../utils/calculations';
import InfoTooltip from '../components/InfoTooltip';

interface Props {
  fxRates: Record<string, number>;
  onNavigateToCorridor: (key: string) => void;
}

type RegionFilter = 'all' | 'europe' | 'americas' | 'apac' | 'emea' | 'latam';
type Currency = 'USD' | 'EUR';
type SortKey = 'country' | 'region' | 'psp' | 'bestMethod' | 'allInPct' | 'settlementDays' | 'fxFee' | 'status' | 'netReceived';
type SortDir = 'asc' | 'desc';

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <span className="px-2.5 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/25 font-medium">Active</span>;
  if (status === 'tbd') return <span className="px-2.5 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">TBC</span>;
  if (status === 'Q4 2026') return <span className="px-2.5 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 font-medium">Q4 2026</span>;
  if (status === 'Not Supported') return <span className="px-2.5 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/25 font-medium">Not Supported</span>;
  return <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400 font-medium">{status}</span>;
}

function RiskBadges({ risk, allInPct, settlementDays, fxFee }: { risk?: string; allInPct: number; settlementDays: number; fxFee: number }) {
  const badges: React.ReactNode[] = [];

  if (risk === 'high' || (!risk && allInPct > 6)) {
    badges.push(
      <span key="high" className="px-2 py-0.5 rounded-full text-xs bg-red-500/12 text-red-400 border border-red-500/20">High Cost</span>
    );
  }
  if (risk === 'settlement' || (!risk && settlementDays > 10)) {
    badges.push(
      <span key="settlement" className="px-2 py-0.5 rounded-full text-xs bg-amber-500/12 text-amber-400 border border-amber-500/20">Long Settlement</span>
    );
  }
  if (risk === 'fx' || (!risk && fxFee > 0.04)) {
    badges.push(
      <span key="fx" className="px-2 py-0.5 rounded-full text-xs bg-orange-500/12 text-orange-400 border border-orange-500/20">FX Risk</span>
    );
  }

  if (badges.length === 0) return <span className="text-slate-600 text-xs">—</span>;
  return <div className="flex flex-col gap-1 items-center">{badges}</div>;
}

// ── Tooltip content ───────────────────────────────────────────────────────────

const ALL_IN_COST_TOOLTIP = (
  <>
    <p className="text-slate-200 font-medium mb-1">All-In Cost Explained</p>
    <p className="text-slate-400">
      Estimated total percentage cost to collect and settle an athlete registration payment in this market.
    </p>
    <div className="border-t border-slate-700/60 pt-2.5 space-y-1.5">
      <p className="text-slate-300 font-medium text-xs mb-1">Calculation includes:</p>
      <div className="space-y-1">
        <div><span className="text-slate-200">PSP Processing Fees</span><span className="text-slate-500"> — Card fees, local rail fees, BNPL fees</span></div>
        <div><span className="text-slate-200">FX Conversion Costs</span><span className="text-slate-500"> — Currency conversion spread between collection and settlement currencies</span></div>
        <div><span className="text-slate-200">Settlement Float Cost</span><span className="text-slate-500"> — Treasury cost of payout timing, e.g. T+1 through T+14</span></div>
        <div><span className="text-slate-200">Operational Assumptions</span><span className="text-slate-500"> — Indicative modeled costs including reconciliation and payment operations overhead</span></div>
      </div>
    </div>
    <div className="border-t border-slate-700/60 pt-2.5 space-y-1.5">
      <p className="text-slate-300 font-medium">Formula</p>
      <p className="font-mono text-slate-400 bg-slate-800 rounded px-2 py-1">(Total Estimated Costs ÷ Registration Value) × 100</p>
      <p className="text-slate-500">Example: $30 costs on a $500 registration = 6.0% all-in cost</p>
    </div>
  </>
);

const SETTLEMENT_TOOLTIP = (
  <p className="text-slate-300">Estimated payout timing from collection date to settlement — expressed as T+N calendar days. Longer windows increase treasury float exposure.</p>
);

const FX_FEE_TOOLTIP = (
  <p className="text-slate-300">Estimated currency conversion cost between the collection currency (local) and settlement currency (USD or EUR). Applies to all non-USD-denominated markets.</p>
);

const RISK_TOOLTIP = (
  <p className="text-slate-300">Operational, treasury, FX, or settlement considerations for this corridor that require monitoring or inform routing decisions.</p>
);

const NET_RECEIVED_TOOLTIP = (
  <p className="text-slate-300">Estimated net amount received after all-in costs are deducted from a $500 registration. Displayed in selected currency.</p>
);

// ─────────────────────────────────────────────────────────────────────────────

function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronUp size={11} className="text-slate-700 ml-0.5 flex-shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="text-sky-400 ml-0.5 flex-shrink-0" />
    : <ChevronDown size={11} className="text-sky-400 ml-0.5 flex-shrink-0" />;
}

const DEFAULT_AMOUNT = 500;

export default function Overview({ fxRates, onNavigateToCorridor }: Props) {
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('allInPct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currency, setCurrency] = useState<Currency>('USD');

  const eurRate = fxRates['EUR'] || 0.92;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const dLocalRows = useMemo(() => Object.entries(DLOCAL_CORRIDORS).map(([key, c]) => {
    const best = c.methods.find(m => m.name === c.recommended) || c.methods[0];
    const cost = calculateCost(DEFAULT_AMOUNT, best.processing, 0, best.fx, best.settlement);
    const netReceived = DEFAULT_AMOUNT * (1 - cost.totalPct / 100);
    return {
      key, country: c.country, flag: c.flag, region: c.region, psp: 'dLocal',
      bestMethod: best.name, allInPct: cost.totalPct, settlementDays: best.settlement,
      fxFee: best.fx, status: c.status, risk: c.risk as string | undefined,
      netReceived,
    };
  }), []);

  const stripeRows = useMemo(() => Object.entries(STRIPE_MARKETS).map(([key, m]) => {
    const cost = calculateCost(DEFAULT_AMOUNT, 0.029, 0.30, 0.015, m.settlement_days);
    const netReceived = DEFAULT_AMOUNT * (1 - cost.totalPct / 100);
    return {
      key: `stripe_${key}`, country: m.country, flag: m.flag, region: m.region, psp: 'Stripe',
      bestMethod: m.adaptive ? 'Adaptive Pricing' : (m.klarna ? 'Cards + Klarna' : 'Cards'),
      allInPct: cost.totalPct, settlementDays: m.settlement_days, fxFee: 0.015,
      status: 'active', risk: undefined as string | undefined,
      netReceived,
    };
  }), []);

  const allRows = useMemo(() => [...dLocalRows, ...stripeRows], [dLocalRows, stripeRows]);

  // Dynamic stat card computations
  // Scan every method across all dLocal corridors to find the true worst-case cost
  const highestCostRow = useMemo(() => {
    let best = allRows[0];
    let bestPct = best?.allInPct ?? 0;
    Object.entries(DLOCAL_CORRIDORS).forEach(([key, c]) => {
      c.methods.forEach(mth => {
        const cost = calculateCost(DEFAULT_AMOUNT, mth.processing, 0, mth.fx, mth.settlement);
        if (cost.totalPct > bestPct) {
          bestPct = cost.totalPct;
          best = { ...allRows.find(r => r.key === key)!, allInPct: cost.totalPct, bestMethod: mth.name };
        }
      });
    });
    return best;
  }, [allRows]);

  const longestSettlementRow = useMemo(() => {
    return allRows.reduce((max, r) => r.settlementDays > max.settlementDays ? r : max, allRows[0]);
  }, [allRows]);

  const filtered = useMemo(() => {
    const base = allRows.filter(r => {
      const regionMatch = regionFilter === 'all' ||
        (regionFilter === 'europe' && r.region === 'Europe') ||
        (regionFilter === 'americas' && (r.region === 'Americas' || r.region === 'LATAM')) ||
        (regionFilter === 'apac' && r.region === 'APAC') ||
        (regionFilter === 'emea' && r.region === 'EMEA') ||
        (regionFilter === 'latam' && r.region === 'LATAM');
      const searchMatch = !search || r.country.toLowerCase().includes(search.toLowerCase());
      return regionMatch && searchMatch;
    });

    return [...base].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'country':     aVal = a.country;       bVal = b.country;       break;
        case 'region':      aVal = a.region;        bVal = b.region;        break;
        case 'psp':         aVal = a.psp;           bVal = b.psp;           break;
        case 'bestMethod':  aVal = a.bestMethod;    bVal = b.bestMethod;    break;
        case 'allInPct':    aVal = a.allInPct;      bVal = b.allInPct;      break;
        case 'settlementDays': aVal = a.settlementDays; bVal = b.settlementDays; break;
        case 'fxFee':       aVal = a.fxFee;         bVal = b.fxFee;         break;
        case 'status':      aVal = a.status;        bVal = b.status;        break;
        case 'netReceived': aVal = a.netReceived;   bVal = b.netReceived;   break;
        default:            aVal = a.allInPct;      bVal = b.allInPct;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [allRows, regionFilter, search, sortKey, sortDir]);

  const activeCount = allRows.filter(r => r.status === 'active').length;
  const bnplCount = BNPL_MARKETS.length;

  // Top 3 high-priority alerts (critical first, then warning)
  const topAlerts = useMemo(() => {
    return PORTFOLIO_ALERTS
      .filter(a => a.severity === 'critical' || a.severity === 'warning')
      .slice(0, 3);
  }, []);

  function formatNetReceived(amount: number): string {
    if (currency === 'EUR') {
      return `€${(amount * eurRate).toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  }

  function exportCSV() {
    const headers = ['Market', 'Region', 'PSP', 'Method', 'All-In %', 'Settlement', 'FX %', 'Status', 'Risk'];
    const rows = filtered.map(r => {
      const riskParts: string[] = [];
      if (r.risk === 'high' || (!r.risk && r.allInPct > 6)) riskParts.push('High Cost');
      if (r.risk === 'settlement' || (!r.risk && r.settlementDays > 10)) riskParts.push('Long Settlement');
      if (r.risk === 'fx' || (!r.risk && r.fxFee > 0.04)) riskParts.push('FX Risk');
      return [
        `"${r.country}"`,
        `"${r.region}"`,
        `"${r.psp}"`,
        `"${r.bestMethod}"`,
        r.allInPct.toFixed(2),
        `T+${r.settlementDays}`,
        (r.fxFee * 100).toFixed(1),
        `"${r.status}"`,
        `"${riskParts.join('; ') || '—'}"`,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment-corridors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const REGION_FILTERS: { id: RegionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'europe', label: 'Europe' },
    { id: 'americas', label: 'Americas' },
    { id: 'apac', label: 'APAC' },
    { id: 'emea', label: 'EMEA' },
    { id: 'latam', label: 'LatAm' },
  ];

  function thClass(align: 'left' | 'right' | 'center', extra = '') {
    return `px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-medium cursor-pointer select-none hover:text-slate-300 transition-colors text-${align} ${extra}`;
  }

  return (
    <div className="space-y-6">

      {/* Helper microcopy */}
      <p className="text-xs text-slate-500">
        Calculations based on contracted rate data and live ECB FX rates · Operational estimates
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <TrendingUp size={15} className="text-sky-400" />
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500">Active Corridors</span>
          </div>
          <div className="text-3xl font-mono font-bold text-white">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-1.5">dLocal + Stripe markets</div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle size={15} className="text-red-400" />
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500">Highest Cost</span>
          </div>
          <div className="text-3xl font-mono font-bold text-red-400">
            {highestCostRow ? `${highestCostRow.allInPct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {highestCostRow ? `${highestCostRow.flag} ${highestCostRow.country} — ${highestCostRow.bestMethod.toLowerCase()}` : '—'}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock size={15} className="text-amber-400" />
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500">Longest Settlement</span>
          </div>
          <div className="text-3xl font-mono font-bold text-amber-400">
            {longestSettlementRow ? `T+${longestSettlementRow.settlementDays}` : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {longestSettlementRow ? `${longestSettlementRow.flag} ${longestSettlementRow.country} — ${longestSettlementRow.bestMethod.toLowerCase()}` : '—'}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <CreditCard size={15} className="text-teal-400" />
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500">BNPL Markets</span>
          </div>
          <div className="text-3xl font-mono font-bold text-teal-400">{bnplCount}</div>
          <div className="text-xs text-slate-500 mt-1.5">markets with BNPL available</div>
        </div>
      </div>

      {/* Portfolio Alerts */}
      {topAlerts.length > 0 && (
        <div className="space-y-2">
          {topAlerts.map((alert, i) => {
            const isCritical = alert.severity === 'critical';
            const bgClass = isCritical ? 'bg-red-500/8 border-red-500/25' : 'bg-amber-500/8 border-amber-500/25';
            const iconClass = isCritical ? 'text-red-400' : 'text-amber-400';
            const titleClass = isCritical ? 'text-red-300' : 'text-amber-300';
            const labelClass = isCritical
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
            return (
              <div key={i} className={`border rounded-lg px-4 py-3.5 ${bgClass}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={14} className={`${iconClass} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${labelClass}`}>
                        {isCritical ? 'Critical' : 'Warning'}
                      </span>
                      <span className={`text-sm font-medium ${titleClass}`}>
                        {alert.flag} {alert.market} — {alert.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{alert.detail}</p>
                    <p className="text-xs text-slate-500 mt-1"><span className="text-slate-400 font-medium">Action:</span> {alert.action}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-800 border border-slate-700 rounded-lg">
          {REGION_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setRegionFilter(f.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                regionFilter === f.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Currency selector */}
          <div className="flex gap-0.5 p-0.5 bg-slate-800 border border-slate-700 rounded-lg">
            {(['USD', 'EUR'] as Currency[]).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currency === c ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search market..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-48 transition-colors"
            />
          </div>
          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Payment Corridors</span>
              <p className="text-xs text-slate-500 mt-1">
                Estimated payment collection economics across active PSP corridors using modelled treasury and settlement assumptions.
              </p>
            </div>
            <span className="text-xs text-slate-600 whitespace-nowrap mt-0.5">Based on $500 registration</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {/* Market */}
                <th className={thClass('left', 'px-5')} onClick={() => handleSort('country')}>
                  <div className="flex items-center gap-0.5">
                    <span>Market</span>
                    <SortIndicator col="country" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Country</span>
                </th>
                {/* Region */}
                <th className={thClass('left')} onClick={() => handleSort('region')}>
                  <div className="flex items-center gap-0.5">
                    <span>Region</span>
                    <SortIndicator col="region" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Geo Cluster</span>
                </th>
                {/* PSP */}
                <th className={thClass('left')} onClick={() => handleSort('psp')}>
                  <div className="flex items-center gap-0.5">
                    <span>PSP</span>
                    <SortIndicator col="psp" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Payment Provider</span>
                </th>
                {/* Best Method */}
                <th className={thClass('left')} onClick={() => handleSort('bestMethod')}>
                  <div className="flex items-center gap-0.5">
                    <span>Best Method</span>
                    <SortIndicator col="bestMethod" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Recommended Rail</span>
                </th>
                {/* All-In Cost */}
                <th className={thClass('right')} onClick={() => handleSort('allInPct')}>
                  <div className="flex items-center justify-end gap-0.5">
                    <span>All-In Cost</span>
                    <InfoTooltip content={ALL_IN_COST_TOOLTIP} width={360} />
                    <SortIndicator col="allInPct" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Collection &amp; Settlement</span>
                </th>
                {/* Net Received */}
                <th className={thClass('right')} onClick={() => handleSort('netReceived')}>
                  <div className="flex items-center justify-end gap-0.5">
                    <span>Net Received</span>
                    <InfoTooltip content={NET_RECEIVED_TOOLTIP} width={260} />
                    <SortIndicator col="netReceived" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">{currency} after costs</span>
                </th>
                {/* Settlement */}
                <th className={thClass('right')} onClick={() => handleSort('settlementDays')}>
                  <div className="flex items-center justify-end gap-0.5">
                    <span>Settlement</span>
                    <InfoTooltip content={SETTLEMENT_TOOLTIP} width={260} />
                    <SortIndicator col="settlementDays" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Payout Timing</span>
                </th>
                {/* FX Fee */}
                <th className={thClass('right')} onClick={() => handleSort('fxFee')}>
                  <div className="flex items-center justify-end gap-0.5">
                    <span>FX Fee</span>
                    <InfoTooltip content={FX_FEE_TOOLTIP} width={260} />
                    <SortIndicator col="fxFee" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Conversion Cost</span>
                </th>
                {/* Status */}
                <th className={thClass('center')} onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-0.5">
                    <span>Status</span>
                    <SortIndicator col="status" sortKey={sortKey} sortDir={sortDir} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Operational</span>
                </th>
                {/* Risk */}
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-medium text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <span>Risk</span>
                    <InfoTooltip content={RISK_TOOLTIP} width={260} />
                  </div>
                  <span className="block text-slate-700 normal-case tracking-normal font-normal text-xs mt-0.5">Treasury Alerts</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const isHighCost = row.allInPct > 6;
                const isLongSett = row.settlementDays > 10;
                const isDLocal = !row.key.startsWith('stripe_');
                return (
                  <tr
                    key={row.key}
                    onClick={() => isDLocal ? onNavigateToCorridor(row.key) : undefined}
                    className={`border-b border-slate-700/40 transition-colors ${
                      isDLocal ? 'cursor-pointer hover:bg-slate-700/25' : 'hover:bg-slate-700/15'
                    }`}
                  >
                    <td className="px-5 py-4 text-white font-medium">
                      <span className="mr-2.5">{row.flag}</span>{row.country}
                      {isDLocal && <span className="ml-2 text-slate-700 text-xs">↗</span>}
                    </td>
                    <td className="px-4 py-4 text-slate-400 text-xs">{row.region}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.psp === 'Stripe' ? 'bg-sky-500/12 text-sky-400' : 'bg-emerald-500/12 text-emerald-400'
                      }`}>{row.psp}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-300 text-sm">{row.bestMethod}</td>
                    <td className="px-4 py-4 text-right font-mono">
                      <span className={`font-semibold text-sm ${isHighCost ? 'text-red-400' : 'text-white'}`}>
                        {row.allInPct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      <span className="text-sm text-slate-300">
                        {formatNetReceived(row.netReceived)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      <span className={`text-sm ${isLongSett ? 'text-amber-400 font-semibold' : 'text-white'}`}>
                        T+{row.settlementDays}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-slate-400 text-sm">{(row.fxFee * 100).toFixed(1)}%</td>
                    <td className="px-4 py-4 text-center"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-4 text-center">
                      <RiskBadges
                        risk={row.risk}
                        allInPct={row.allInPct}
                        settlementDays={row.settlementDays}
                        fxFee={row.fxFee}
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-500">No corridors match this filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pipeline section */}
        <div className="border-t border-slate-700 px-5 py-3.5 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-slate-500">Pipeline Markets</span>
          <span className="text-xs text-slate-600">Corridors under evaluation — not yet operational</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-5 py-2.5 text-xs uppercase tracking-widest text-slate-600 font-medium w-52">Market</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-slate-600 font-medium w-24">Region</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-slate-600 font-medium w-24">PSP</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widests text-slate-600 font-medium w-24">Currency</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widests text-slate-600 font-medium">Readiness</th>
                <th className="text-center px-4 py-2.5 text-xs uppercase tracking-widests text-slate-600 font-medium w-32">Activation</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE_MARKETS.map(m => {
                const readinessPct = m.readiness ?? 0;
                const readinessColor =
                  readinessPct === 0 ? 'bg-slate-600' :
                  readinessPct < 40 ? 'bg-red-500/70' :
                  readinessPct < 70 ? 'bg-amber-500/70' :
                  'bg-sky-500/70';
                return (
                  <tr key={m.country} className="border-b border-slate-700/30 hover:bg-slate-700/15 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 font-medium w-52">
                      <span className="mr-2.5">{m.flag}</span>{m.country}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs w-24">{m.region}</td>
                    <td className="px-4 py-3.5 w-24">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-500">{m.psp}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs w-24 font-mono">{m.currency}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-[80px] max-w-[140px]">
                          <div
                            className={`h-full rounded-full transition-all ${readinessColor}`}
                            style={{ width: `${readinessPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 font-mono w-8">{readinessPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={m.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
