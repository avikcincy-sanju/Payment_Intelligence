import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { DLOCAL_CORRIDORS, STRIPE_MARKETS, WHY_IT_MATTERS, DEFAULT_WHY_MATTERS } from '../data/constants';
import { calculateCost, fmtPct, formatMoney, convertDisplay } from '../utils/calculations';
import { useAssumptions } from '../context/AssumptionsContext';
import InfoTooltip from '../components/InfoTooltip';
import CostBreakdownHover from '../components/CostBreakdownHover';

interface Props {
  fxRates: Record<string, number>;
  fxTimestamp: string;
  initialCorridor?: string;
}

// Inline sparkline bar for All-In Cost column
function CostSparkline({ pct, maxPct = 10 }: { pct: number; maxPct?: number }) {
  const width = Math.min(100, (pct / maxPct) * 100);
  const color = pct > 6 ? '#ef4444' : pct > 4 ? '#f59e0b' : '#22c55e';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <span className={`font-mono font-semibold text-sm w-14 text-right ${pct > 6 ? 'text-red-400' : 'text-white'}`}>
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

// Outlier badge
function OutlierBadge({ fx, settlement }: { fx: number; settlement: number }) {
  const badges: React.ReactNode[] = [];
  if (fx > 0.04) badges.push(
    <span key="fx" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-500/12 text-orange-400 border border-orange-500/20">
      <AlertTriangle size={9} /> FX
    </span>
  );
  if (settlement > 7) badges.push(
    <span key="sett" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/12 text-amber-400 border border-amber-500/20">
      <AlertTriangle size={9} /> T+{settlement}
    </span>
  );
  if (badges.length === 0) return null;
  return <div className="flex gap-1 mt-1 flex-wrap">{badges}</div>;
}

export default function CorridorDeepDive({ fxRates, fxTimestamp, initialCorridor }: Props) {
  const [selectedKey, setSelectedKey] = useState(initialCorridor || 'brazil');
  const [amount, setAmount] = useState(500);
  const [settleCurrency, setSettleCurrency] = useState<'USD' | 'EUR'>('USD');
  const { assumptions } = useAssumptions();

  const corridor = DLOCAL_CORRIDORS[selectedKey];
  const stripeMarket = STRIPE_MARKETS[selectedKey];

  const overrides = {
    floatCostAnnualPct: assumptions.settlement.floatCostPct,
    platformFeePct: assumptions.platform.platformFeePct,
  };

  const methods = useMemo(() => {
    if (corridor) {
      return corridor.methods.map(m => {
        const cost = calculateCost(amount, m.processing, 0, m.fx, m.settlement, 0.01, overrides);
        return { ...m, cost };
      });
    }
    if (stripeMarket) {
      const fxStd = assumptions.fxSpreads.stripeStandard / 100;
      const fxAdp = assumptions.fxSpreads.stripeAdaptive / 100;
      const fxKlr = assumptions.fxSpreads.klarna / 100;
      const base = [
        { name: 'Stripe Standard', processing: 0.029, processingFlat: 0.30, fx: fxStd, settlement: stripeMarket.settlement_days, bnpl: false },
        ...(stripeMarket.adaptive ? [{ name: 'Adaptive Pricing', processing: 0.029, processingFlat: 0.30, fx: fxAdp, settlement: stripeMarket.settlement_days, bnpl: false }] : []),
        ...(stripeMarket.klarna ? [{ name: 'Klarna (BNPL)', processing: 0.0349, processingFlat: 0.49, fx: fxKlr, settlement: 1, bnpl: true }] : []),
      ];
      return base.map(m => {
        const cost = calculateCost(amount, m.processing, m.processingFlat, m.fx, m.settlement, 0.01, overrides);
        return { name: m.name, processing: m.processing, fx: m.fx, settlement: m.settlement, bnpl: m.bnpl, cost };
      });
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, amount, corridor, stripeMarket, assumptions]);

  const maxCostPct = useMemo(() => Math.max(...methods.map(m => m.cost.totalPct), 10), [methods]);

  const recommendedName = corridor?.recommended || (stripeMarket?.adaptive ? 'Adaptive Pricing' : 'Stripe Standard');
  const recMethod = methods.find(m => m.name === recommendedName) || methods[0];
  const whyPoints = WHY_IT_MATTERS[selectedKey] || DEFAULT_WHY_MATTERS;

  const countryInfo = corridor
    ? { flag: corridor.flag, country: corridor.country, currency: corridor.currency, region: corridor.region }
    : stripeMarket
    ? { flag: stripeMarket.flag, country: stripeMarket.country, currency: stripeMarket.currency, region: stripeMarket.region }
    : null;

  // High-risk corridor detection
  const isHighRisk = corridor?.risk === 'high' || corridor?.risk === 'fx' || corridor?.risk === 'settlement';
  const highRiskNote =
    corridor?.risk === 'high' ? 'High all-in cost — review cost recovery and pricing strategy with Treasury.' :
    corridor?.risk === 'fx' ? 'Elevated FX exposure in this corridor — review with Treasury before activating.' :
    corridor?.risk === 'settlement' ? 'Extended settlement window — treasury float planning required.' : null;

  const [showCostComposition, setShowCostComposition] = useState(false);
  const [showAllMethodsComposition, setShowAllMethodsComposition] = useState(false);

  // Display conversion helper
  const d = (usd: number) => convertDisplay(usd, settleCurrency, fxRates);
  const m = (usd: number) => formatMoney(d(usd), settleCurrency);

  // Cost composition segments for recommended method
  const segments = recMethod ? [
    { label: 'Processing', value: recMethod.cost.processingCost, color: '#0ea5e9' },
    { label: 'FX', value: recMethod.cost.fxCost, color: '#f59e0b' },
    { label: 'Float', value: recMethod.cost.floatCost, color: '#3b82f6' },
    { label: 'Platform', value: recMethod.cost.platformCost, color: '#64748b' },
    { label: 'Additional', value: recMethod.cost.additionalFixed, color: '#475569' },
    { label: 'Net Received', value: recMethod.cost.netReceived, color: '#22c55e' },
  ] : [];

  // Worst method: highest totalCost among all methods
  const worstMethod = useMemo(() => {
    if (methods.length < 2) return null;
    return methods.reduce((worst, mth) => mth.cost.totalCost > worst.cost.totalCost ? mth : worst, methods[0]);
  }, [methods]);

  // Savings vs worst method (only meaningful if rec !== worst)
  const savingsVsWorst = useMemo(() => {
    if (!recMethod || !worstMethod || recMethod.name === worstMethod.name) return null;
    return worstMethod.cost.totalCost - recMethod.cost.totalCost;
  }, [recMethod, worstMethod]);

  // Dynamic recommended action
  const recommendedAction = useMemo(() => {
    if (!recMethod) {
      return corridor
        ? `Route athlete registrations via ${corridor.recommended} for lowest all-in cost and optimal settlement timing in this corridor.`
        : stripeMarket?.adaptive
        ? `Enable Adaptive Pricing to reduce FX conversion cost from 1.5% to 0.4% for non-${stripeMarket.currency} athletes registering in this market.`
        : `Stripe Standard applies. Evaluate Klarna for premium race entries above local equivalent of $300.`;
    }

    // If there's a cheaper alternative to the current worst
    if (methods.length >= 2 && worstMethod && recMethod.name !== worstMethod.name) {
      const savedAmt = worstMethod.cost.totalCost - recMethod.cost.totalCost;
      const savedPct = ((savedAmt / worstMethod.cost.totalCost) * 100).toFixed(1);
      return `Switching from ${worstMethod.name} to ${recMethod.name} saves ${savedPct}% (${formatMoney(savedAmt)}) per registration.`;
    }

    // If cards exist and a local rail is cheaper
    const cardMethod = methods.find(mth => mth.name === 'Stripe Standard' || mth.name === 'Card');
    const localRail = methods.find(mth => mth.name !== 'Stripe Standard' && mth.name !== 'Card' && !mth.bnpl);
    if (cardMethod && localRail && localRail.cost.totalPct < cardMethod.cost.totalPct) {
      const ratio = (cardMethod.cost.totalPct / localRail.cost.totalPct).toFixed(1);
      return `Local rail (${localRail.name}) is ${ratio}x cheaper than cards at ${fmtPct(localRail.cost.totalPct)} all-in.`;
    }

    // Fallback to original static logic
    return corridor
      ? `Route athlete registrations via ${corridor.recommended} for lowest all-in cost and optimal settlement timing in this corridor.`
      : stripeMarket?.adaptive
      ? `Enable Adaptive Pricing to reduce FX conversion cost from 1.5% to 0.4% for non-${stripeMarket.currency} athletes registering in this market.`
      : `Stripe Standard applies. Evaluate Klarna for premium race entries above local equivalent of $300.`;
  }, [recMethod, worstMethod, methods, corridor, stripeMarket]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = ['Method', 'Processing%', 'FX%', 'Settlement', 'All-In%', 'Net Received (USD)'];
    const rows = methods.map(mth => [
      mth.name,
      fmtPct(mth.processing * 100),
      fmtPct(mth.fx * 100),
      `T+${mth.settlement}`,
      fmtPct(mth.cost.totalPct),
      mth.cost.netReceived.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const marketName = countryInfo?.country?.toLowerCase().replace(/\s+/g, '-') || selectedKey;
    link.download = `corridor-${marketName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currencyTooltip = (
    <>
      <p className="text-slate-200 font-medium mb-1">Display Currency Only</p>
      <p className="text-slate-400">
        Switching display currency does not affect underlying calculations — display only.
        All cost modelling and net recovery calculations are performed in USD.
      </p>
      {fxTimestamp && (
        <div className="border-t border-slate-700/60 pt-2 mt-2 space-y-1 text-slate-500">
          <div><span className="text-slate-400">FX Source:</span> ECB / Frankfurter API</div>
          <div><span className="text-slate-400">Last Updated:</span> {fxTimestamp}</div>
          {countryInfo && <div><span className="text-slate-400">Market:</span> {countryInfo.currency}</div>}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-52">
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

          <div className="w-44">
            <label className="text-xs uppercase tracking-widests text-slate-400 block mb-2">Registration Value (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="number" min={50} max={5000} value={amount}
                onChange={e => setAmount(Math.max(50, Math.min(5000, Number(e.target.value))))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widests text-slate-400 block mb-2 flex items-center gap-1">
              Display Currency
              <InfoTooltip content={currencyTooltip} width={300} />
            </label>
            <div className="flex gap-1 p-1 bg-slate-900 border border-slate-700 rounded-lg">
              {(['USD', 'EUR'] as const).map(c => (
                <button key={c} onClick={() => setSettleCurrency(c)}
                  className={`px-4 py-1.5 text-sm font-mono font-medium rounded transition-colors ${
                    settleCurrency === c ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >{c}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1.5">
              <RefreshCw size={10} className="text-slate-600" />
              <span>Display only — costs unchanged</span>
            </div>
          </div>

          {countryInfo && (
            <div className="ml-auto text-right">
              <div className="text-2xl leading-none">{countryInfo.flag}</div>
              <div className="text-sm font-semibold text-white mt-1.5">{countryInfo.country}</div>
              <div className="text-xs text-slate-500 mt-0.5">{countryInfo.currency} · {countryInfo.region}</div>
            </div>
          )}
        </div>
      </div>

      {/* High-risk corridor alert */}
      {isHighRisk && highRiskNote && (
        <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/25 border-l-4 border-l-red-500 rounded-lg px-4 py-3">
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">High-Risk Corridor</span>
            <p className="text-sm text-red-300/80 mt-0.5">{highRiskNote}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Methods + breakdown */}
        <div className="xl:col-span-3 space-y-5">

          {/* Methods table */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-700 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widests text-slate-500">Payment Methods</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">Hover a row for cost breakdown</span>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-colors"
                  title="Export corridor data as CSV"
                >
                  <Download size={11} />
                  Export CSV
                </button>
              </div>
            </div>
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3.5 text-xs uppercase tracking-widest text-slate-400 font-medium w-48">Method</th>
                    <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap w-28">Processing</th>
                    <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap w-28">FX Fee</th>
                    <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap w-28">Settlement</th>
                    <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap w-44">All-In Cost</th>
                    <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap w-32">Net Received</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map(mth => {
                    const isRec = mth.name === recommendedName;
                    const fxOutlier = mth.fx > 0.04;
                    const settlOutlier = mth.settlement > 7;
                    return (
                      <CostBreakdownHover key={mth.name} breakdown={mth.cost} amount={amount}>
                        <tr className={`border-b border-slate-700/40 transition-colors hover:bg-slate-700/20 ${isRec ? 'border-l-4 border-l-green-500' : ''}`}>
                          <td className="px-5 py-3.5 w-48">
                            <div className="text-sm">
                              <div className="flex items-center gap-2">
                                <span className={isRec ? 'text-white font-medium' : 'text-slate-300'}>{mth.name}</span>
                                {isRec && <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs bg-green-500/12 text-green-400 border border-green-500/25">✓ Rec</span>}
                                {mth.bnpl && (
                                  <InfoTooltip
                                    content={<p className="text-slate-300">BNPL method. Refunds are processed as per BNPL provider rules — typically longer refund windows and provider-managed dispute handling.</p>}
                                    width={260}
                                  >
                                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs bg-teal-500/12 text-teal-400 border border-teal-500/25 cursor-help">BNPL</span>
                                  </InfoTooltip>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-sm text-slate-400 whitespace-nowrap w-28">{fmtPct(mth.processing * 100)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap w-28">
                            <div className="flex items-center justify-end gap-1 font-mono text-sm">
                              <span className={fxOutlier ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
                                {fmtPct(mth.fx * 100)}
                              </span>
                              <span className="w-4 flex-shrink-0 flex justify-center">
                                {fxOutlier ? (
                                  <InfoTooltip
                                    content={<p className="text-slate-300">FX fee exceeds 4% — high conversion cost. Review with Treasury before activating this rail.</p>}
                                    width={240}
                                  />
                                ) : null}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap w-28">
                            <div className="flex items-center justify-end gap-1 font-mono text-sm">
                              <span className={settlOutlier ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                                T+{mth.settlement}
                              </span>
                              <span className="w-4 flex-shrink-0 flex justify-center">
                                {settlOutlier ? (
                                  <InfoTooltip
                                    content={<p className="text-slate-300">Settlement exceeds T+7 — extended float exposure. Treasury planning recommended for events with rapid payout requirements.</p>}
                                    width={240}
                                  />
                                ) : null}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap w-44">
                            <CostSparkline pct={mth.cost.totalPct} maxPct={maxCostPct} />
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-green-400 font-semibold text-sm whitespace-nowrap w-32">{m(mth.cost.netReceived)}</td>
                        </tr>
                      </CostBreakdownHover>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key metric boxes */}
          {recMethod && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="text-xs uppercase tracking-widests text-slate-500 mb-2.5">Total Cost</div>
                <div className="text-xl font-mono font-bold text-white">{m(recMethod.cost.totalCost)}</div>
                <div className="text-xs text-slate-500 mt-1">{fmtPct(recMethod.cost.totalPct)}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="text-xs uppercase tracking-widests text-slate-500 mb-2.5">Net Received</div>
                <div className="text-xl font-mono font-bold text-green-400">{m(recMethod.cost.netReceived)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  of {m(amount)}
                  <span className="ml-1 text-slate-600">
                    ({((recMethod.cost.netReceived / amount) * 100).toFixed(1)}% of gross)
                  </span>
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-1 mb-2.5">
                  <span className="text-xs uppercase tracking-widests text-slate-500">All-In Rate</span>
                  <InfoTooltip
                    content={<p className="text-slate-300">Total estimated cost as a percentage of registration value. Includes PSP fees, FX conversion, settlement float, and operational assumptions.</p>}
                    width={260}
                  />
                </div>
                <div className={`text-xl font-mono font-bold ${recMethod.cost.totalPct > 6 ? 'text-red-400' : 'text-sky-400'}`}>
                  {fmtPct(recMethod.cost.totalPct)}
                </div>
                <div className="text-xs text-slate-500 mt-1">recommended method</div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">PSP fees · FX · float · operational</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="text-xs uppercase tracking-widests text-slate-500 mb-2.5">Settlement</div>
                <div className={`text-xl font-mono font-bold ${recMethod.settlement > 10 ? 'text-amber-400' : 'text-white'}`}>
                  T+{recMethod.settlement}
                </div>
                <div className="text-xs text-slate-500 mt-1">days to payout</div>
              </div>

              {/* Savings vs worst method — only shown when 2+ methods and rec !== worst */}
              {methods.length >= 2 && worstMethod && savingsVsWorst !== null && recMethod.name !== worstMethod.name && (
                <div className="col-span-2 sm:col-span-4 bg-slate-800 border border-green-500/30 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-widests text-slate-500 mb-2.5">vs Worst Method</div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <div className="text-xl font-mono font-bold text-green-400">
                      +{m(savingsVsWorst)} saved
                    </div>
                    <div className="text-sm text-slate-400">
                      vs <span className="text-slate-300 font-medium">{worstMethod.name}</span>
                      <span className="text-slate-600 ml-1">({fmtPct(worstMethod.cost.totalPct)} all-in)</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Per registration using {recMethod.name} instead of {worstMethod.name}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View Cost Composition expandable */}
          {recMethod && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowCostComposition(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700/20 transition-colors"
              >
                <span className="text-xs text-slate-400 font-medium">View Cost Composition</span>
                {showCostComposition ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
              </button>

              {showCostComposition && (
                <div className="border-t border-slate-700 px-5 py-4">
                  {/* Toggle: show all methods vs recommended only */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-500">
                      {showAllMethodsComposition ? 'Showing all methods' : `Showing: ${recommendedName}`}
                    </span>
                    {methods.length >= 2 && (
                      <button
                        onClick={() => setShowAllMethodsComposition(v => !v)}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors underline underline-offset-2"
                      >
                        {showAllMethodsComposition ? 'Show recommended only' : 'Show all methods'}
                      </button>
                    )}
                  </div>

                  {/* All-methods comparison table */}
                  {showAllMethodsComposition && methods.length >= 2 ? (
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 pr-4 text-slate-400 font-medium">Method</th>
                            <th className="text-right py-2 px-3 text-slate-400 font-medium whitespace-nowrap">Processing%</th>
                            <th className="text-right py-2 px-3 text-slate-400 font-medium whitespace-nowrap">FX%</th>
                            <th className="text-right py-2 px-3 text-slate-400 font-medium whitespace-nowrap">Float%</th>
                            <th className="text-right py-2 pl-3 text-slate-400 font-medium whitespace-nowrap">All-In%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {methods.map(mth => {
                            const isRec = mth.name === recommendedName;
                            const processingPct = (mth.cost.processingCost / amount) * 100;
                            const fxPct = (mth.cost.fxCost / amount) * 100;
                            const floatPct = (mth.cost.floatCost / amount) * 100;
                            return (
                              <tr key={mth.name} className={`border-b border-slate-700/40 ${isRec ? 'bg-green-500/5' : ''}`}>
                                <td className="py-2.5 pr-4">
                                  <span className={isRec ? 'text-green-400 font-medium' : 'text-slate-300'}>{mth.name}</span>
                                  {isRec && <span className="ml-1.5 text-green-600">✓</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-300">{fmtPct(processingPct)}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-300">{fmtPct(fxPct)}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-300">{fmtPct(floatPct)}</td>
                                <td className={`py-2.5 pl-3 text-right font-mono font-semibold ${mth.cost.totalPct > 6 ? 'text-red-400' : isRec ? 'text-green-400' : 'text-slate-200'}`}>
                                  {fmtPct(mth.cost.totalPct)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* Recommended-only bar chart breakdown */
                    <div className="space-y-1.5 mb-4">
                      {[
                        { label: 'Processing Fees',    value: recMethod.cost.processingCost, color: '#0ea5e9' },
                        { label: 'FX Costs',           value: recMethod.cost.fxCost,         color: '#f59e0b' },
                        { label: 'Settlement Float',   value: recMethod.cost.floatCost,      color: '#3b82f6' },
                        { label: 'Operational Buffer', value: recMethod.cost.platformCost + recMethod.cost.additionalFixed, color: '#64748b' },
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
                        <span className="text-xs font-mono font-bold text-white w-12 text-right">{fmtPct(recMethod.cost.totalPct)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0 bg-green-500" />
                        <span className="text-xs font-semibold text-green-400 flex-1">Net Recovery</span>
                        <div className="flex-1" />
                        <span className="text-xs font-mono font-bold text-green-400 w-12 text-right">{(100 - recMethod.cost.totalPct).toFixed(2)}%</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-600">Indicative modelled assumptions used for corridor comparison.</p>
                </div>
              )}
            </div>
          )}

          {/* Cost composition bar */}
          {recMethod && segments.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <div className="text-xs uppercase tracking-widests text-slate-500 mb-4">Cost Composition — {recommendedName}</div>
              <div className="flex h-5 rounded overflow-hidden mb-5" style={{ gap: '1px' }}>
                {segments.map(s => (
                  <div
                    key={s.label}
                    className="transition-all duration-300 first:rounded-l last:rounded-r"
                    style={{ width: `${Math.max(0, (s.value / amount) * 100)}%`, backgroundColor: s.color, opacity: s.label === 'Net Received' ? 0.9 : 0.75 }}
                    title={`${s.label}: ${m(s.value)}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {segments.map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-slate-500">{s.label}</span>
                    <span className="text-xs font-mono text-slate-300 ml-auto">{m(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 text-xs text-slate-600">
            {fxTimestamp && <span>FX rates as of {fxTimestamp} · ECB/Frankfurter API</span>}
          </div>
        </div>

        {/* Right: Why This Matters */}
        <div className="xl:col-span-2">
          <div className="bg-slate-800 border border-l-4 border-slate-700 border-l-teal-500 rounded-lg p-6 sticky top-24">
            <div className="text-xs uppercase tracking-widests text-teal-400 mb-4 font-semibold">Why This Matters</div>

            <ul className="space-y-3.5 mb-6">
              {whyPoints.map((point, i) => (
                <li key={i} className="flex gap-2.5">
                  <ChevronRight size={13} className="text-teal-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/60">
              <div className="text-xs font-semibold text-green-400 uppercase tracking-widests mb-2">Recommended Action</div>
              <p className="text-sm text-slate-200 leading-relaxed">{recommendedAction}</p>
            </div>

            {countryInfo && (
              <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Currency</span>
                  <div className="font-mono text-white mt-0.5">{countryInfo.currency}</div>
                </div>
                <div>
                  <span className="text-slate-500">Region</span>
                  <div className="text-white mt-0.5">{countryInfo.region}</div>
                </div>
                {corridor && (
                  <>
                    <div>
                      <span className="text-slate-500">PSP</span>
                      <div className="text-white mt-0.5">dLocal</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Methods Available</span>
                      <div className="text-white mt-0.5">{corridor.methods.length}</div>
                    </div>
                  </>
                )}
                {isHighRisk && (
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                      <AlertTriangle size={11} />
                      <span>High FX or settlement risk — review with Treasury.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
