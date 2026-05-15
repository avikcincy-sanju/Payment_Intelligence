import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DLOCAL_CORRIDORS, STRIPE_MARKETS, PIPELINE_MARKETS, WHY_IT_MATTERS, DEFAULT_WHY_MATTERS } from '../data/constants';
import { calculateCost, fmt, fmtPct, nextTuesdayAfterSettlement } from '../utils/calculations';
import { AlertTriangle } from 'lucide-react';
import { useAssumptions, payoutFrequencyToDays, MOR_MODELS, type MorModel } from '../context/AssumptionsContext';

interface Props {
  fxTimestamp: string;
}

const ALL_DLOCAL_KEYS = Object.entries(DLOCAL_CORRIDORS).map(([k, v]) => ({ key: k, label: `${v.flag} ${v.country}` }));
const ALL_STRIPE_KEYS = Object.entries(STRIPE_MARKETS).map(([k, v]) => ({ key: k, label: `${v.flag} ${v.country}` }));
const PIPELINE_KEYS = PIPELINE_MARKETS.filter(m => m.status !== 'Not Supported').map(m => ({ key: m.country.toLowerCase().replace(' ', '_'), label: `${m.flag} ${m.country}`, pipelineData: m }));

// ── Utility: blob-download a JSON object ──────────────────────────────────────
function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScenarioModeler({ fxTimestamp }: Props) {
  // Scenario A
  const [railCorridor, setRailCorridor] = useState('india');
  const [railMonthlyVolume, setRailMonthlyVolume] = useState(50000);
  const [railAvgValue, setRailAvgValue] = useState(500); // Change 2: avg value input

  // Multi-corridor aggregator
  const [aggRows, setAggRows] = useState<{ corridorKey: string; volume: number }[]>([
    { corridorKey: 'india', volume: 30000 },
    { corridorKey: 'brazil', volume: 40000 },
  ]);

  // Scenario B
  const [pipelineMarketKey, setPipelineMarketKey] = useState('taiwan');
  const [pipelineRegistrations, setPipelineRegistrations] = useState(500);
  const [pipelineAvgValue, setPipelineAvgValue] = useState(400);
  const [compareMode, setCompareMode] = useState(false);
  const [pipelineMarketKey2, setPipelineMarketKey2] = useState('south_korea');

  // Scenario C
  const [cashflowMarket, setCashflowMarket] = useState('brazil');
  const [cashflowRegistrations, setCashflowRegistrations] = useState(200);
  const [cashflowAvgValue, setCashflowAvgValue] = useState(500);
  const [cashflowEventDate, setCashflowEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });
  // Change 3: local MOR model selector for Scenario C
  const [cashflowMorModel, setCashflowMorModel] = useState<MorModel>('im_mor');

  // === Scenario A computations ===
  const railCorridorData = DLOCAL_CORRIDORS[railCorridor];
  const railStripeData = STRIPE_MARKETS[railCorridor];
  const railMethods = useMemo(() => {
    if (railCorridorData) return railCorridorData.methods;
    if (railStripeData) return [
      { name: 'Stripe Standard', processing: 0.029, fx: 0.015, settlement: railStripeData.settlement_days },
      ...(railStripeData.adaptive ? [{ name: 'Adaptive Pricing', processing: 0.029, fx: 0.004, settlement: railStripeData.settlement_days }] : []),
      ...(railStripeData.klarna ? [{ name: 'Klarna', processing: 0.0349, fx: 0.015, settlement: 1 }] : []),
    ];
    return [];
  }, [railCorridor, railCorridorData, railStripeData]);

  const [currentMethod, setCurrentMethod] = useState('');
  const [altMethod, setAltMethod] = useState('');

  const effCurrentMethod = currentMethod || (railCorridorData?.methods[0]?.name || railMethods[0]?.name || '');
  const effAltMethod = altMethod || (railMethods[1]?.name || railMethods[0]?.name || '');

  const curM = railMethods.find(m => m.name === effCurrentMethod) || railMethods[0];
  const altM = railMethods.find(m => m.name === effAltMethod) || railMethods[0];

  // Change 2: use railAvgValue state instead of hardcoded $500; derive per-tx count from monthlyVolume / avgValue
  const curCost = curM ? calculateCost(railAvgValue, curM.processing, 0, curM.fx, curM.settlement) : null;
  const altCost = altM ? calculateCost(railAvgValue, altM.processing, 0, altM.fx, altM.settlement) : null;
  const perTxSaving = curCost && altCost ? curCost.totalCost - altCost.totalCost : 0;
  const estMonthlyRegs = railAvgValue > 0 ? railMonthlyVolume / railAvgValue : 0;
  const monthlySaving = perTxSaving * estMonthlyRegs;
  const annualSaving = monthlySaving * 12;
  const settlementGain = curM && altM ? curM.settlement - altM.settlement : 0;

  // Change 5: sensitivity preview ±25% volume
  const annualSavingHigh = perTxSaving * (railMonthlyVolume * 1.25 / (railAvgValue > 0 ? railAvgValue : 1)) * 12;
  const annualSavingLow  = perTxSaving * (railMonthlyVolume * 0.75 / (railAvgValue > 0 ? railAvgValue : 1)) * 12;

  const railChartData = curM && altM ? [
    { name: (curM.name.length > 14 ? curM.name.slice(0, 13) + '…' : curM.name), pct: parseFloat(((curM.processing + curM.fx) * 100).toFixed(2)), fill: '#ef4444' },
    { name: (altM.name.length > 14 ? altM.name.slice(0, 13) + '…' : altM.name), pct: parseFloat(((altM.processing + altM.fx) * 100).toFixed(2)), fill: '#22c55e' },
  ] : [];

  // Multi-corridor aggregator
  const aggTotal = aggRows.reduce((sum, row) => {
    const c = DLOCAL_CORRIDORS[row.corridorKey];
    if (!c) return sum;
    const rec = c.methods.find(m => m.name === c.recommended) || c.methods[0];
    const defM = c.methods[0];
    const saving = (defM.processing + defM.fx - rec.processing - rec.fx) * row.volume;
    return sum + saving * 12;
  }, 0);

  // === Scenario B ===
  function pipelineCalc(marketKey: string) {
    const pMarket = PIPELINE_MARKETS.find(m => m.country.toLowerCase().replace(' ', '_') === marketKey || m.country.toLowerCase() === marketKey);
    const dlKey = Object.keys(DLOCAL_CORRIDORS).find(k => k === marketKey);
    const corrData = dlKey ? DLOCAL_CORRIDORS[dlKey] : null;
    if (!corrData && !pMarket) return null;
    // Use pipeline market's estimated rates or fallback to similar corridor
    const method = corrData ? (corrData.methods.find(m => m.name === corrData.recommended) || corrData.methods[0]) : { name: 'Cards', processing: 0.03, fx: 0.01, settlement: 5 };
    const gross = pipelineRegistrations * pipelineAvgValue;
    const cost = calculateCost(gross, method.processing, 0, method.fx, method.settlement, 0.01);
    const country = corrData ? corrData.country : pMarket?.country || marketKey;
    const flag = corrData ? corrData.flag : pMarket?.flag || '';
    return { country, flag, method, gross, cost, pipelineData: pMarket };
  }

  const pipelineResult1 = useMemo(() => pipelineCalc(pipelineMarketKey), [pipelineMarketKey, pipelineRegistrations, pipelineAvgValue]);
  const pipelineResult2 = useMemo(() => compareMode ? pipelineCalc(pipelineMarketKey2) : null, [pipelineMarketKey2, pipelineRegistrations, pipelineAvgValue, compareMode]);

  // Change 6: cost difference for compare mode
  const costDiff = useMemo(() => {
    if (!compareMode || !pipelineResult1 || !pipelineResult2) return null;
    const diff = pipelineResult1.cost.totalCost - pipelineResult2.cost.totalCost;
    const pct = pipelineResult1.gross > 0 ? Math.abs(diff) / pipelineResult1.gross * 100 : 0;
    if (Math.abs(diff) < 0.01) return { cheaper: null, diff: 0, pct: 0 };
    return {
      cheaper: diff > 0 ? pipelineResult2.country : pipelineResult1.country,
      diff: Math.abs(diff),
      pct,
    };
  }, [compareMode, pipelineResult1, pipelineResult2]);

  // Global assumptions — payout frequency
  const { assumptions } = useAssumptions();

  // Change 3: derive payout frequency from cashflowMorModel selection
  const cashflowMorDef = MOR_MODELS.find(m => m.key === cashflowMorModel)!;
  const cashflowPayoutFreq =
    cashflowMorModel === 'im_mor'       ? assumptions.morPayout.imMor :
    cashflowMorModel === 'licensee_mor' ? assumptions.morPayout.licenseeMor :
    assumptions.morPayout.ownedEvent;
  const activePlatformPayoutDays = payoutFrequencyToDays(cashflowPayoutFreq);

  // === Scenario C ===
  const cashflowMethod = useMemo(() => {
    const c = DLOCAL_CORRIDORS[cashflowMarket];
    if (c) return c.methods.find(m => m.name === c.recommended) || c.methods[0];
    const s = STRIPE_MARKETS[cashflowMarket];
    if (s) return { name: 'Stripe Standard', processing: 0.029, fx: 0.015, settlement: s.settlement_days };
    return null;
  }, [cashflowMarket]);

  const cashflowGross = cashflowRegistrations * cashflowAvgValue;
  const cashflowCost = cashflowMethod ? calculateCost(cashflowGross, cashflowMethod.processing, 0, cashflowMethod.fx, cashflowMethod.settlement) : null;

  const eventClose = cashflowEventDate ? new Date(cashflowEventDate) : new Date();
  // PSP settlement date
  const pspSettledDate = cashflowMethod
    ? new Date(eventClose.getTime() + cashflowMethod.settlement * 24 * 60 * 60 * 1000)
    : null;
  const payoutDate = cashflowMethod ? nextTuesdayAfterSettlement(eventClose, cashflowMethod.settlement) : null;
  const daysToSettle = payoutDate ? Math.round((payoutDate.getTime() - eventClose.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  // Total treasury exposure = settlement + avg payout lag
  const avgPayoutLag = Math.round(activePlatformPayoutDays / 2);
  const totalExposureDays = cashflowMethod ? cashflowMethod.settlement + avgPayoutLag : 0;

  const ALL_MARKETS_FOR_CASHFLOW = [
    ...Object.entries(DLOCAL_CORRIDORS).map(([k, v]) => ({ key: k, label: `${v.flag} ${v.country}` })),
    ...Object.entries(STRIPE_MARKETS).map(([k, v]) => ({ key: k, label: `${v.flag} ${v.country}` })),
  ];

  // ── Export helpers ────────────────────────────────────────────────────────────

  function exportScenarioA() {
    downloadJson('scenario-a-rail-shift.json', {
      scenario: 'Rail Shift Simulator',
      inputs: {
        corridor: railCorridor,
        monthlyVolume: railMonthlyVolume,
        avgRegistrationValue: railAvgValue,
        currentMethod: effCurrentMethod,
        alternativeMethod: effAltMethod,
      },
      results: {
        currentRoutingAllInPct: curM ? parseFloat(((curM.processing + curM.fx) * 100).toFixed(4)) : null,
        alternativeRoutingAllInPct: altM ? parseFloat(((altM.processing + altM.fx) * 100).toFixed(4)) : null,
        perTransactionSaving: parseFloat(perTxSaving.toFixed(4)),
        estimatedMonthlyRegistrations: Math.round(estMonthlyRegs),
        monthlySaving: parseFloat(monthlySaving.toFixed(2)),
        annualSaving: parseFloat(annualSaving.toFixed(2)),
        settlementDaysGained: settlementGain,
        sensitivity: {
          volumeUp25pct: parseFloat(annualSavingHigh.toFixed(2)),
          volumeDown25pct: parseFloat(annualSavingLow.toFixed(2)),
        },
      },
    });
  }

  function exportScenarioB() {
    downloadJson('scenario-b-new-market.json', {
      scenario: 'New Market Launch Simulator',
      inputs: {
        projectedRegistrations: pipelineRegistrations,
        averageValue: pipelineAvgValue,
        market1: pipelineMarketKey,
        ...(compareMode ? { market2: pipelineMarketKey2 } : {}),
      },
      results: {
        market1: pipelineResult1 ? {
          country: pipelineResult1.country,
          method: pipelineResult1.method.name,
          grossRevenue: pipelineResult1.gross,
          netReceived: parseFloat(pipelineResult1.cost.netReceived.toFixed(2)),
          totalCostPct: parseFloat(pipelineResult1.cost.totalPct.toFixed(4)),
        } : null,
        ...(compareMode && pipelineResult2 ? {
          market2: {
            country: pipelineResult2.country,
            method: pipelineResult2.method.name,
            grossRevenue: pipelineResult2.gross,
            netReceived: parseFloat(pipelineResult2.cost.netReceived.toFixed(2)),
            totalCostPct: parseFloat(pipelineResult2.cost.totalPct.toFixed(4)),
          },
          costDifference: costDiff ? {
            cheaperMarket: costDiff.cheaper,
            differenceUsd: parseFloat(costDiff.diff.toFixed(2)),
            differencePct: parseFloat(costDiff.pct.toFixed(2)),
          } : null,
        } : {}),
      },
    });
  }

  function exportScenarioC() {
    downloadJson('scenario-c-cashflow-timeline.json', {
      scenario: 'Event Cashflow Timeline',
      inputs: {
        market: cashflowMarket,
        eventCloseDate: cashflowEventDate,
        registrations: cashflowRegistrations,
        averageValue: cashflowAvgValue,
        morModel: cashflowMorModel,
        payoutFrequency: cashflowPayoutFreq,
      },
      results: {
        grossRevenue: cashflowGross,
        netReceived: cashflowCost ? parseFloat(cashflowCost.netReceived.toFixed(2)) : null,
        pspSettlementDays: cashflowMethod?.settlement ?? null,
        avgPayoutLagDays: avgPayoutLag,
        totalExposureDays,
        disbursementDate: payoutDate ? payoutDate.toISOString().split('T')[0] : null,
      },
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Scenario Modeler</h1>
          <p className="text-sm text-slate-400 mt-1">Model payment cost impact across routing changes, new markets, and event cashflow</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">Phase 3 · Preview</span>
          <span className="px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-400 border border-slate-600 font-medium">Illustrative estimates</span>
        </div>
      </div>

      {/* Global disclaimer */}
      <div className="border border-l-4 border-amber-500/20 border-l-amber-500 bg-amber-500/5 rounded-lg p-4 flex gap-3">
        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">
          Scenario outputs are directional estimates based on contracted rate data, live ECB FX rates, and user-entered volume assumptions. Actual results depend on transaction mix and currency movements.
        </p>
      </div>

      {/* ─── Scenario A: Rail Shift ─── */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {/* Change 4: Export button in card header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Rail Shift Simulator</h2>
            <p className="text-xs text-slate-500 mt-0.5">Estimate annual saving from switching payment method defaults</p>
          </div>
          <button
            onClick={exportScenarioA}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-sky-500/50 hover:text-sky-400 transition-colors flex-shrink-0"
          >
            Export JSON
          </button>
        </div>

        {/* Change 2: 5-column grid — adds Avg Registration Value input */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Corridor</label>
            <select
              value={railCorridor}
              onChange={e => { setRailCorridor(e.target.value); setCurrentMethod(''); setAltMethod(''); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              <optgroup label="dLocal">
                {ALL_DLOCAL_KEYS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </optgroup>
              <optgroup label="Stripe">
                {ALL_STRIPE_KEYS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Current Method</label>
            <select
              value={effCurrentMethod}
              onChange={e => setCurrentMethod(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              {railMethods.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Alternative Method</label>
            <select
              value={effAltMethod}
              onChange={e => setAltMethod(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              {railMethods.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Monthly Volume ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min={0}
                value={railMonthlyVolume}
                onChange={e => setRailMonthlyVolume(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          {/* Change 2: new Avg Registration Value input */}
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Avg Registration Value ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min={1}
                value={railAvgValue}
                onChange={e => setRailAvgValue(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {[
              { label: 'Current Routing', value: curM ? `${curM.name} — ${((curM.processing + curM.fx) * 100).toFixed(2)}% all-in` : '—', color: 'text-red-400' },
              { label: 'Alternative Routing', value: altM ? `${altM.name} — ${((altM.processing + altM.fx) * 100).toFixed(2)}% all-in` : '—', color: 'text-green-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-700">
                <span className="text-sm text-slate-400">{row.label}</span>
                <span className={`font-mono text-sm ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className="pt-2 space-y-2">
              {[
                { label: 'Per Transaction Saving', value: `$${fmt(perTxSaving)}`, color: perTxSaving > 0 ? 'text-green-400' : 'text-red-400' },
                { label: `Monthly Volume Saving (${Math.round(estMonthlyRegs).toLocaleString()} txns)`, value: `$${fmt(monthlySaving)}`, color: perTxSaving > 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Projected Annual Saving', value: `$${fmt(annualSaving)}`, color: perTxSaving > 0 ? 'text-green-400 font-bold text-xl' : 'text-red-400 text-xl' },
                { label: 'Settlement Days Gained', value: settlementGain > 0 ? `${settlementGain} days faster` : settlementGain < 0 ? `${Math.abs(settlementGain)} days slower` : 'Same speed', color: settlementGain > 0 ? 'text-sky-400' : settlementGain < 0 ? 'text-amber-400' : 'text-slate-400' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{row.label}</span>
                  <span className={`font-mono ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Change 5: Sensitivity preview chips */}
            <div className="pt-3 border-t border-slate-700">
              <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Sensitivity</div>
              <div className="flex gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
                  annualSavingHigh >= 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  <span className="text-slate-400 font-sans">If volume +25%:</span>
                  ${fmt(annualSavingHigh)}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
                  annualSavingLow >= 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  <span className="text-slate-400 font-sans">If volume −25%:</span>
                  ${fmt(annualSavingLow)}
                </span>
              </div>
            </div>
          </div>

          <div>
            {railChartData.length === 2 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={railChartData} barSize={56}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => [`${(v as number).toFixed(2)}%`, 'All-In Cost']}
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {railChartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Multi-corridor aggregator */}
        <div className="mt-6 pt-5 border-t border-slate-700">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Multi-Corridor Aggregator</div>
          <div className="space-y-2 mb-3">
            {aggRows.map((row, i) => (
              <div key={i} className="flex gap-3 items-center">
                <select
                  value={row.corridorKey}
                  onChange={e => setAggRows(prev => prev.map((r, j) => j === i ? { ...r, corridorKey: e.target.value } : r))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 flex-1"
                >
                  {ALL_DLOCAL_KEYS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    value={row.volume}
                    onChange={e => setAggRows(prev => prev.map((r, j) => j === i ? { ...r, volume: Number(e.target.value) } : r))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
                {aggRows.length > 1 && (
                  <button onClick={() => setAggRows(prev => prev.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400 transition-colors text-sm">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            {aggRows.length < 5 && (
              <button
                onClick={() => setAggRows(prev => [...prev, { corridorKey: 'chile', volume: 20000 }])}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
              >+ Add corridor</button>
            )}
            <div className="text-right ml-auto">
              <div className="text-xs text-slate-500">Combined Annual Optimization Potential</div>
              <div className="text-2xl font-mono font-bold text-green-400">${aggTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Scenario B: New Market ─── */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-white">New Market Launch Simulator</h2>
            <p className="text-xs text-slate-500 mt-0.5">Estimate payment economics before committing to a new event market</p>
          </div>
          {/* Change 4: Export button; Change 1: uses assumptions.morPayout.imMor (verified correct) */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={exportScenarioB}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-sky-500/50 hover:text-sky-400 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${compareMode ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}
            >
              {compareMode ? '✓ Compare Mode' : 'Compare Two Markets'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Pipeline Market</label>
            <select
              value={pipelineMarketKey}
              onChange={e => setPipelineMarketKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              {[...ALL_DLOCAL_KEYS, ...PIPELINE_KEYS.map(k => ({ key: k.key, label: k.label }))].map(k => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </div>
          {compareMode && (
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Compare Market</label>
              <select
                value={pipelineMarketKey2}
                onChange={e => setPipelineMarketKey2(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
              >
                {[...ALL_DLOCAL_KEYS, ...PIPELINE_KEYS.map(k => ({ key: k.key, label: k.label }))].map(k => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Projected Registrations</label>
            <input
              type="number"
              min={1}
              value={pipelineRegistrations}
              onChange={e => setPipelineRegistrations(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Average Value ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min={10}
                value={pipelineAvgValue}
                onChange={e => setPipelineAvgValue(Math.max(10, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div className={`grid ${compareMode && pipelineResult2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-xl'} gap-6`}>
          {[pipelineResult1, compareMode ? pipelineResult2 : null].filter(Boolean).map((result, idx) => result && (
            <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded-lg p-5 space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{result.flag}</span>
                <span className="font-semibold text-white">{result.country}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">dLocal</span>
              </div>
              {[
                { label: 'Best Available Method', value: result.method.name },
                { label: 'Projected Gross Revenue', value: `$${fmt(result.gross)}` },
                { label: `Est. Processing Cost (${fmtPct(result.method.processing * 100)})`, value: `-$${fmt(result.cost.processingCost)}`, neg: true },
                { label: `Est. FX Conversion Cost (${fmtPct(result.method.fx * 100)})`, value: `-$${fmt(result.cost.fxCost)}`, neg: true },
                { label: 'Est. Float Cost', value: `-$${fmt(result.cost.floatCost)}`, neg: true },
                { label: 'Platform Fee (1%)', value: `-$${fmt(result.cost.platformCost)}`, neg: true },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between text-sm ${i === 0 ? 'pb-3 mb-1 border-b border-slate-700' : ''}`}>
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`font-mono ${row.neg ? 'text-red-400' : 'text-white'}`}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-slate-600 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-white">Projected Net Revenue</span>
                  <span className="font-mono font-bold text-green-400 text-base">${fmt(result.cost.netReceived)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Effective Cost Rate</span>
                  <span className="font-mono text-white">{result.cost.totalPct.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Expected Settlement</span>
                  <span className="font-mono text-white">T+{result.method.settlement} days after event close</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Change 6: Cost difference row in compare mode */}
        {compareMode && costDiff && pipelineResult1 && pipelineResult2 && (
          <div className="mt-4 bg-slate-900/50 border border-slate-700 rounded-lg px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs uppercase tracking-widest text-slate-500">Cost Difference</div>
            {costDiff.cheaper === null ? (
              <span className="text-sm text-slate-400 font-mono">Identical cost for both markets</span>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-white">
                  <span className="font-semibold text-green-400">{costDiff.cheaper}</span>
                  {' '}is cheaper by{' '}
                  <span className="font-mono text-green-400">${fmt(costDiff.diff)}</span>
                  {' '}
                  <span className="font-mono text-slate-400">({costDiff.pct.toFixed(2)}% of gross)</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Why it matters for pipeline market */}
        {pipelineResult1 && (
          <div className="mt-5 border border-l-4 border-slate-700 border-l-teal-500 rounded-lg p-4">
            <div className="text-xs uppercase tracking-widest text-teal-400 mb-2">Market Readiness Note</div>
            <ul className="space-y-1">
              {(WHY_IT_MATTERS[pipelineMarketKey] || DEFAULT_WHY_MATTERS).map((point, i) => (
                <li key={i} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-teal-500 flex-shrink-0">›</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ─── Scenario C: Event Cashflow Timeline ─── */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {/* Change 4: Export button in card header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Event Cashflow Timeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">Visualize when registration revenue lands based on payout cycle and settlement timing</p>
          </div>
          <button
            onClick={exportScenarioC}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-sky-500/50 hover:text-sky-400 transition-colors flex-shrink-0"
          >
            Export JSON
          </button>
        </div>

        {/* Change 3: 5-column grid — adds MOR model selector */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Market</label>
            <select
              value={cashflowMarket}
              onChange={e => setCashflowMarket(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              {ALL_MARKETS_FOR_CASHFLOW.map(k => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Event Close Date</label>
            <input
              type="date"
              value={cashflowEventDate}
              onChange={e => setCashflowEventDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Registrations</label>
            <input
              type="number"
              min={1}
              value={cashflowRegistrations}
              onChange={e => setCashflowRegistrations(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Average Value ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min={10}
                value={cashflowAvgValue}
                onChange={e => setCashflowAvgValue(Math.max(10, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          {/* Change 3: MOR model selector */}
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">MOR Model</label>
            <select
              value={cashflowMorModel}
              onChange={e => setCashflowMorModel(e.target.value as MorModel)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              {MOR_MODELS.map(m => (
                <option key={m.key} value={m.key}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {cashflowMethod && cashflowCost && payoutDate && pspSettledDate && (
          <>
            {/* Timeline visualization — 5 nodes: open → close → PSP settled → payout cadence → disbursement */}
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-5 mb-4">
              <div className="relative">
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700" />
                <div className="relative flex justify-between">
                  {[
                    { label: 'Registrations Open', note: 'Ongoing', color: 'bg-slate-600', sub: null },
                    { label: 'Event Close', note: new Date(cashflowEventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'bg-sky-500', sub: null },
                    { label: 'PSP Settlement', note: `T+${cashflowMethod.settlement}`, color: 'bg-amber-500', sub: pspSettledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
                    // Change 3: Payout Cycle node uses cashflowMorDef icon + cashflowPayoutFreq from selected MOR model
                    { label: 'Payout Cycle', note: `${cashflowMorDef.icon} ${cashflowPayoutFreq}`, color: 'bg-teal-500', sub: `~${avgPayoutLag}d lag` },
                    { label: 'Disbursement', note: payoutDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), color: 'bg-green-500', sub: null },
                  ].map((node, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 z-10">
                      <div className={`w-3 h-3 rounded-full ${node.color} ring-2 ring-slate-900`} />
                      <div className="text-center max-w-20">
                        <div className="text-xs font-medium text-white leading-tight">{node.label}</div>
                        <div className="text-xs text-slate-400">{node.note}</div>
                        {node.sub && <div className="text-xs text-slate-600">{node.sub}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Settlement vs Payout distinction */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-500 mb-1">Settlement Timing <span className="text-slate-700">(PSP rail)</span></div>
                <div className={`font-mono font-bold text-lg ${cashflowMethod.settlement > 14 ? 'text-amber-400' : 'text-white'}`}>
                  T+{cashflowMethod.settlement} days
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Time from capture to PSP availability. Fixed per rail.</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3">
                {/* Change 3: Show MOR icon next to payout frequency label */}
                <div className="text-xs text-slate-500 mb-1">Payout Frequency <span className="text-slate-700">(MOR rule)</span></div>
                <div className="font-mono font-bold text-lg text-sky-400 flex items-center gap-1.5">
                  <span>{cashflowMorDef.icon}</span>
                  <span>{cashflowPayoutFreq}</span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{cashflowMorDef.label} disbursement cadence. Configurable in Admin Config.</div>
              </div>
            </div>

            {/* Treasury gap indicator — uses totalExposureDays */}
            <div className={`rounded-lg p-4 mb-4 border-l-4 ${
              totalExposureDays > 20 ? 'bg-red-500/5 border-red-500 border border-red-500/20' :
              totalExposureDays > 10 ? 'bg-amber-500/5 border-amber-500 border border-amber-500/20' :
              'bg-green-500/5 border-green-500 border border-green-500/20'
            }`}>
              <div className={`font-semibold mb-1 text-sm ${totalExposureDays > 20 ? 'text-red-400' : totalExposureDays > 10 ? 'text-amber-400' : 'text-green-400'}`}>
                {totalExposureDays > 20
                  ? `Extended treasury exposure — ~${totalExposureDays} days total. Bridge funding may be required.`
                  : totalExposureDays > 10
                  ? `Moderate treasury exposure — ~${totalExposureDays} days from event close to disbursement.`
                  : `Efficient cashflow — ~${totalExposureDays} days total treasury exposure.`
                }
              </div>
              <div className="flex flex-wrap gap-6 mt-3">
                <div>
                  <div className="text-xs text-slate-500">PSP Settlement (T+N)</div>
                  <div className="text-xl font-mono font-bold text-white">{cashflowMethod.settlement}d</div>
                </div>
                <div>
                  {/* Change 3: show MOR icon inline in treasury summary */}
                  <div className="text-xs text-slate-500">Avg Payout Lag</div>
                  <div className="text-xl font-mono font-bold text-sky-400">~{avgPayoutLag}d</div>
                  <div className="text-xs text-slate-600">{cashflowMorDef.icon} {cashflowPayoutFreq}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Total Exposure</div>
                  <div className="text-xl font-mono font-bold text-white">~{totalExposureDays}d</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Net Settlement</div>
                  <div className="text-xl font-mono font-bold text-green-400">${fmt(cashflowCost.netReceived)}</div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Settlement Timing is fixed by the {cashflowMethod.name} payment rail. Payout Frequency reflects {cashflowMorDef.label} rules and can be adjusted in Admin Config.
              </p>
            </div>

            <div className="text-xs text-slate-500">
              Total expected net settlement: <span className="font-mono text-white font-semibold">${fmt(cashflowCost.netReceived)}</span> · Disbursement by{' '}
              <span className="text-white">{payoutDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
          </>
        )}

        {fxTimestamp && (
          <p className="text-xs text-slate-500 mt-3">Calculated using FX rates as of {fxTimestamp}</p>
        )}
      </section>
    </div>
  );
}
