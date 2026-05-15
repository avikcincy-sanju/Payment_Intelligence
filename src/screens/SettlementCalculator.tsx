import React, { useState, useMemo } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { DLOCAL_CORRIDORS, STRIPE_MARKETS } from '../data/constants';
import { fmtPct, formatMoney, convertDisplay, nextTuesdayAfterSettlement } from '../utils/calculations';
import { useAssumptions, activeMorPayoutFrequency, payoutFrequencyToDays, MOR_MODELS, type MorModel, type PayoutFrequency } from '../context/AssumptionsContext';
import InfoTooltip from '../components/InfoTooltip';

interface Props {
  fxRates: Record<string, number>;
  fxTimestamp: string;
}

const PAYOUT_FREQ_OPTIONS: PayoutFrequency[] = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly'];

function methodOverheadMultiplier(methodName: string): number {
  const n = methodName.toLowerCase();
  if (n.includes('pix') || n.includes('upi') || n.includes('spei') || n.includes('bank transfer') || n.includes('virtual accounts')) return 0.6;
  if (n.includes('bnpl') || n.includes('klarna') || n.includes('pareto') || n.includes('pagaleve') || n.includes('powerpay') || n.includes('tamara')) return 1.4;
  if (n.includes('card')) return 1.2;
  return 1.0;
}

const SETTLEMENT_TIMING_TOOLTIP = (
  <p className="text-slate-300">Estimated time from payment capture to PSP settlement availability — driven by the payment rail and PSP contract. Independent of disbursement frequency.</p>
);

const PAYOUT_FREQ_TOOLTIP = (
  <p className="text-slate-300">Frequency of disbursement to the licensee or platform account, determined by the MOR model and business rules. Does not affect PSP settlement timing.</p>
);

const TREASURY_EXPOSURE_TOOLTIP = (
  <>
    <p className="text-slate-200 font-medium mb-1">Treasury Exposure Explained</p>
    <p className="text-slate-400">The window between PSP settlement availability and actual disbursement to the licensee. Driven by Payout Frequency, not Settlement Timing.</p>
    <div className="border-t border-slate-700/60 pt-2 mt-1 space-y-1 text-slate-400">
      <div><span className="text-slate-200">Settlement Timing</span> — PSP rail T+N (fixed per payment method)</div>
      <div><span className="text-slate-200">Payout Frequency</span> — MOR disbursement cadence (configurable)</div>
      <div><span className="text-slate-200">Total Exposure</span> — Settlement days + days until next payout cycle</div>
    </div>
  </>
);

const MOR_TOOLTIP = (
  <>
    <p className="text-slate-200 font-medium mb-1">MOR Model</p>
    <p className="text-slate-400 mb-2">Select one of the 3 MOR models: IM as MOR, Licensee as MOR, or Owned Events.</p>
    <div className="space-y-2 text-xs">
      {MOR_MODELS.map(m => (
        <div key={m.key} className="flex gap-2">
          <span className="flex-shrink-0">{m.icon}</span>
          <div>
            <span className="text-slate-200 font-medium">{m.label}</span>
            <span className="text-slate-500"> — {m.description}</span>
          </div>
        </div>
      ))}
    </div>
  </>
);

export default function SettlementCalculator({ fxRates, fxTimestamp }: Props) {
  const { assumptions, setAssumptions } = useAssumptions();

  const [marketKey, setMarketKey] = useState('brazil');
  const [grossRevenue, setGrossRevenue] = useState(50000);
  const [numRegistrations, setNumRegistrations] = useState(100);
  const [methodOverride, setMethodOverride] = useState('');
  const [morModel, setMorModel] = useState<MorModel>('im_mor');
  const [settleCurrency, setSettleCurrency] = useState<'USD' | 'EUR'>('USD');
  const [eventCloseDate, setEventCloseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const corridor = DLOCAL_CORRIDORS[marketKey];
  const stripeMarket = STRIPE_MARKETS[marketKey];

  const methods = corridor
    ? corridor.methods.map(m => ({ name: m.name, processing: m.processing, fx: m.fx, settlement: m.settlement }))
    : stripeMarket
    ? [
        { name: 'Stripe Standard', processing: 0.029, fx: 0.015, settlement: stripeMarket.settlement_days },
        ...(stripeMarket.adaptive ? [{ name: 'Adaptive Pricing', processing: 0.029, fx: 0.004, settlement: stripeMarket.settlement_days }] : []),
        ...(stripeMarket.klarna ? [{ name: 'Klarna (BNPL)', processing: 0.0349, fx: 0.015, settlement: 1 }] : []),
      ]
    : [];

  const defaultMethod = corridor ? corridor.recommended : 'Stripe Standard';
  const selectedMethodName = methodOverride || defaultMethod;
  const selectedMethod = methods.find(m => m.name === selectedMethodName) || methods[0];

  const [payoutFreqOverride, setPayoutFreqOverride] = useState<PayoutFrequency | null>(null);
  const derivedFreq = activeMorPayoutFrequency(morModel, assumptions.morPayout);
  const activePayoutFreq: PayoutFrequency = payoutFreqOverride ?? derivedFreq;
  const payoutDays = payoutFrequencyToDays(activePayoutFreq);

  function handleMorChange(m: MorModel) {
    setMorModel(m);
    setPayoutFreqOverride(null);
  }

  const isImMor = morModel === 'im_mor';
  const activeMorDef = MOR_MODELS.find(m => m.key === morModel)!;

  const avgValue = numRegistrations > 0 ? grossRevenue / numRegistrations : 0;
  const avgDisbursementLag = Math.round(payoutDays / 2);
  const totalTreasuryExposureDays = selectedMethod ? selectedMethod.settlement + avgDisbursementLag : 0;

  const breakdown = useMemo(() => {
    if (!selectedMethod || grossRevenue <= 0) return null;
    const overheadMod = methodOverheadMultiplier(selectedMethod.name);
    const platformFee = grossRevenue * (assumptions.platform.platformFeePct / 100);
    const processingCost = grossRevenue * selectedMethod.processing;
    const fxCost = grossRevenue * selectedMethod.fx;
    const floatRate = assumptions.settlement.floatCostPct / 100;
    const floatCost = grossRevenue * (floatRate / 365) * selectedMethod.settlement;
    const payoutFloatCost = grossRevenue * (floatRate / 365) * avgDisbursementLag;
    const additionalFees = Math.min(numRegistrations * 0.13 * overheadMod, grossRevenue * 0.005);
    const chargebackBuffer = assumptions.platform.chargebackBufferPct > 0
      ? grossRevenue * (assumptions.platform.chargebackBufferPct / 100)
      : 0;
    const reserveDeduction = grossRevenue * (assumptions.platform.reservePct / 100);
    const totalDeductions = platformFee + processingCost + fxCost + floatCost + payoutFloatCost + additionalFees + chargebackBuffer + reserveDeduction;
    const netSettlement = grossRevenue - totalDeductions;
    const effectiveCostRate = (totalDeductions / grossRevenue) * 100;
    return {
      platformFee, processingCost, fxCost, floatCost, payoutFloatCost,
      additionalFees, chargebackBuffer, reserveDeduction,
      totalDeductions, netSettlement, effectiveCostRate, overheadMod,
    };
  }, [selectedMethod, grossRevenue, numRegistrations, assumptions, avgDisbursementLag]);

  const d = (usd: number) => convertDisplay(usd, settleCurrency, fxRates);
  const money = (usd: number) => formatMoney(d(usd), settleCurrency);

  const currencyNote = settleCurrency === 'EUR'
    ? 'Displayed in EUR using live ECB reference rate.'
    : 'Displayed in USD.';

  const eventClose = eventCloseDate ? new Date(eventCloseDate) : new Date();
  const pspSettledDate = selectedMethod
    ? new Date(eventClose.getTime() + selectedMethod.settlement * 24 * 60 * 60 * 1000)
    : null;
  const payoutDate = selectedMethod ? nextTuesdayAfterSettlement(eventClose, selectedMethod.settlement) : null;
  const daysToSettle = payoutDate
    ? Math.round((payoutDate.getTime() - eventClose.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const methodNote = useMemo(() => {
    if (!selectedMethod) return null;
    const n = selectedMethod.name.toLowerCase();
    if (n.includes('pix')) return 'Pix carries lower dispute exposure and operational overhead than card-based collection.';
    if (n.includes('upi')) return 'UPI carries minimal dispute risk and low operational overhead versus card rails.';
    if (n.includes('spei') || n.includes('bank transfer') || n.includes('virtual accounts')) return 'Bank transfer rail carries lower dispute exposure and reduced chargeback overhead versus cards.';
    if (n.includes('card')) return 'Card processing carries higher dispute and chargeback exposure — reflected in operational overhead estimate.';
    if (n.includes('bnpl') || n.includes('klarna') || n.includes('pareto') || n.includes('pagaleve') || n.includes('powerpay') || n.includes('tamara')) return 'BNPL carries elevated operational overhead due to installment management and provider coordination costs.';
    return null;
  }, [selectedMethod]);

  function persistPayoutFreq(freq: PayoutFrequency) {
    setPayoutFreqOverride(freq);
    if (morModel === 'licensee_mor') {
      setAssumptions(a => ({ ...a, morPayout: { ...a.morPayout, licenseeMor: freq } }));
    } else if (morModel === 'owned_event') {
      setAssumptions(a => ({ ...a, morPayout: { ...a.morPayout, ownedEvent: freq } }));
    }
  }

  // MOR banner content per model
  const morBannerContent: Record<MorModel, { color: string; text: string }> = {
    im_mor: {
      color: 'sky',
      text: 'Under IM as MOR, IRONMAN collects payments and remits to the licensee on a fixed monthly schedule. Treasury exposure includes both the PSP settlement window and the remainder of the monthly disbursement cycle.',
    },
    licensee_mor: {
      color: 'amber',
      text: 'Under Licensee as MOR, the licensee collects payments directly. IRONMAN receives platform fees only. Payout frequency is fully configurable per licensee contract.',
    },
    owned_event: {
      color: 'green',
      text: 'Owned Events use fully centralized processing with IRONMAN direct settlement. Payout frequency is configurable and default weekly.',
    },
  };
  const banner = morBannerContent[morModel];
  const bannerColors: Record<string, { border: string; bg: string; icon: string; text: string }> = {
    sky:   { border: 'border-sky-500/20 border-l-sky-500',   bg: 'bg-sky-500/5',   icon: 'text-sky-400',   text: 'text-sky-200/90' },
    amber: { border: 'border-amber-500/20 border-l-amber-500', bg: 'bg-amber-500/5', icon: 'text-amber-400', text: 'text-amber-200/90' },
    green: { border: 'border-green-500/20 border-l-green-500', bg: 'bg-green-500/5', icon: 'text-green-400', text: 'text-green-200/90' },
  };
  const bc = bannerColors[banner.color];

  return (
    <div className="space-y-6">

      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Event Market</label>
            <select
              value={marketKey}
              onChange={e => { setMarketKey(e.target.value); setMethodOverride(''); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              <optgroup label="dLocal">
                {Object.entries(DLOCAL_CORRIDORS).map(([k, v]) => (
                  <option key={k} value={k}>{v.flag} {v.country}</option>
                ))}
              </optgroup>
              <optgroup label="Stripe">
                {Object.entries(STRIPE_MARKETS).map(([k, v]) => (
                  <option key={k} value={k}>{v.flag} {v.country}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Gross Revenue (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="number" min={0} value={grossRevenue}
                onChange={e => setGrossRevenue(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Registrations</label>
            <input
              type="number" min={1} value={numRegistrations}
              onChange={e => setNumRegistrations(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors"
            />
            {avgValue > 0 && <div className="text-xs text-slate-500 mt-1.5 font-mono">avg ${avgValue.toFixed(0)}</div>}
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Payment Method</label>
            <select
              value={selectedMethodName}
              onChange={e => setMethodOverride(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              {methods.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-2">
              <label className="text-xs uppercase tracking-widest text-slate-400">MOR Model</label>
              <InfoTooltip content={MOR_TOOLTIP} width={320} />
            </div>
            <select
              value={morModel}
              onChange={e => handleMorChange(e.target.value as MorModel)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              {MOR_MODELS.map(m => (
                <option key={m.key} value={m.key}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2">Display Currency</label>
            <div className="flex gap-1 p-1 bg-slate-900 border border-slate-700 rounded-lg">
              {(['USD', 'EUR'] as const).map(c => (
                <button key={c} onClick={() => setSettleCurrency(c)}
                  className={`flex-1 py-1.5 text-sm font-mono font-medium rounded transition-colors ${
                    settleCurrency === c ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}>{c}</button>
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">Display only</div>
          </div>
        </div>
      </div>

      {/* ── MOR Model badge ─────────────────────────────────────────────────── */}
      <div className={`border border-l-4 ${bc.border} ${bc.bg} rounded-lg p-4 flex gap-3`}>
        <span className="text-xl flex-shrink-0 mt-0.5">{activeMorDef.icon}</span>
        <div>
          <div className={`text-sm font-semibold mb-0.5 ${bc.icon}`}>{activeMorDef.label}</div>
          <p className={`text-sm ${bc.text} leading-relaxed`}>{banner.text}</p>
        </div>
      </div>

      {/* ── Settlement Timing + Payout Frequency panel ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Settlement Timing */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Settlement Timing</span>
            <InfoTooltip content={SETTLEMENT_TIMING_TOOLTIP} width={280} />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-3xl font-mono font-bold ${selectedMethod && selectedMethod.settlement > 10 ? 'text-amber-400' : 'text-white'}`}>
              {selectedMethod ? `T+${selectedMethod.settlement}` : '—'}
            </span>
            <span className="text-sm text-slate-500">days</span>
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">
            PSP rail: <span className="text-slate-400">{selectedMethodName}</span>
          </div>
          <div className="text-xs text-slate-600 mt-1">
            Fixed per payment rail. Independent of MOR model or payout frequency.
          </div>
          {selectedMethod && selectedMethod.settlement > 14 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              Extended settlement window — treasury planning required
            </div>
          )}
        </div>

        {/* Payout Frequency */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Payout Frequency</span>
            <InfoTooltip content={PAYOUT_FREQ_TOOLTIP} width={280} />
          </div>

          {isImMor ? (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-mono font-bold text-white">Monthly</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">{activeMorDef.icon} IM as MOR — fixed monthly schedule, non-configurable</div>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-700 border border-slate-600 text-slate-400">
                Fixed — not editable
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PAYOUT_FREQ_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => persistPayoutFreq(opt)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      activePayoutFreq === opt
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:text-white border border-slate-600'
                    }`}
                  >{opt}</button>
                ))}
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                {activeMorDef.icon} {activeMorDef.label} — frequency of disbursement to licensee account.
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Treasury Exposure Summary ─────────────────────────────────────── */}
      {selectedMethod && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-5 py-4">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-medium">Treasury Exposure</span>
              <InfoTooltip content={TREASURY_EXPOSURE_TOOLTIP} width={300} />
            </div>
            <div className="flex items-center gap-6 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Settlement Timing</span>
                <span className="font-mono font-semibold text-white">T+{selectedMethod.settlement}</span>
              </div>
              <span className="text-slate-600">+</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Avg Payout Lag</span>
                <span className="font-mono font-semibold text-sky-400">~{avgDisbursementLag}d</span>
                <span className="text-slate-600 text-xs">({activePayoutFreq})</span>
              </div>
              <span className="text-slate-600">=</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Total Exposure</span>
                <span className={`font-mono font-bold text-base ${totalTreasuryExposureDays > 20 ? 'text-red-400' : totalTreasuryExposureDays > 10 ? 'text-amber-400' : 'text-green-400'}`}>
                  ~{totalTreasuryExposureDays}d
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Settlement Timing is fixed by the PSP payment rail. Payout Frequency is governed by the MOR model and affects disbursement timing only.
          </p>
        </div>
      )}

      {/* ── Waterfall ─────────────────────────────────────────────────────── */}
      {breakdown && selectedMethod && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-400">Settlement Waterfall</span>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>{numRegistrations} registrations</span>
              <span>·</span>
              <span>avg {money(avgValue)}</span>
              <span>·</span>
              <span>{selectedMethodName}</span>
              <span>·</span>
              <span>{activePayoutFreq} payout</span>
            </div>
          </div>

          <div className="px-6 pb-6 pt-2">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-slate-700/60">
                  <td className="py-3.5 text-sm font-semibold text-white">Gross Registration Revenue</td>
                  <td className="py-3.5 text-right font-mono font-semibold text-white text-sm">{money(grossRevenue)}</td>
                  <td className="py-3.5 text-right font-mono text-slate-400 text-sm w-20 pl-4">100.00%</td>
                </tr>

                {[
                  {
                    label: 'Platform Fee',
                    sub: fmtPct(assumptions.platform.platformFeePct),
                    value: breakdown.platformFee,
                    pct: (breakdown.platformFee / grossRevenue) * 100,
                    note: null,
                  },
                  {
                    label: 'PSP Processing Fee',
                    sub: fmtPct(selectedMethod.processing * 100),
                    value: breakdown.processingCost,
                    pct: (breakdown.processingCost / grossRevenue) * 100,
                    note: null,
                  },
                  {
                    label: 'FX Conversion Cost',
                    sub: fmtPct(selectedMethod.fx * 100),
                    value: breakdown.fxCost,
                    pct: (breakdown.fxCost / grossRevenue) * 100,
                    note: selectedMethod.fx === 0 ? 'USD-denominated market — no FX conversion required' : null,
                  },
                  {
                    label: 'Settlement Float Cost',
                    sub: `T+${selectedMethod.settlement} · ${assumptions.settlement.floatCostPct.toFixed(2)}% p.a.`,
                    value: breakdown.floatCost,
                    pct: (breakdown.floatCost / grossRevenue) * 100,
                    note: 'Treasury cost of PSP settlement timing only.',
                  },
                  {
                    label: 'Payout Frequency Float',
                    sub: `~${avgDisbursementLag}d lag · ${activePayoutFreq}`,
                    value: breakdown.payoutFloatCost,
                    pct: (breakdown.payoutFloatCost / grossRevenue) * 100,
                    note: `Additional float cost from ${activePayoutFreq.toLowerCase()} disbursement cadence under ${activeMorDef.icon} ${activeMorDef.label}.`,
                  },
                  {
                    label: 'Additional Processing Fees',
                    sub: 'operational est.',
                    value: breakdown.additionalFees,
                    pct: (breakdown.additionalFees / grossRevenue) * 100,
                    note: 'Includes per-registration operational overhead. Actual values vary by PSP configuration and authentication flow.',
                  },
                  ...(breakdown.chargebackBuffer > 0 ? [{
                    label: 'Chargeback Buffer',
                    sub: fmtPct(assumptions.platform.chargebackBufferPct),
                    value: breakdown.chargebackBuffer,
                    pct: (breakdown.chargebackBuffer / grossRevenue) * 100,
                    note: null,
                  }] : []),
                  ...(breakdown.reserveDeduction > 0 ? [{
                    label: 'Reserve Deduction',
                    sub: fmtPct(assumptions.platform.reservePct),
                    value: breakdown.reserveDeduction,
                    pct: (breakdown.reserveDeduction / grossRevenue) * 100,
                    note: null,
                  }] : []),
                ].map((row, i) => (
                  <React.Fragment key={i}>
                    <tr className="border-b border-slate-700/35 hover:bg-slate-700/15 transition-colors">
                      <td className="py-3 pl-5 text-sm text-slate-400">
                        <span>Less: {row.label}</span>
                        <span className="ml-2 text-xs text-slate-600">({row.sub})</span>
                      </td>
                      <td className="py-3 text-right font-mono text-red-400 text-sm">
                        {row.value > 0 ? `−${money(row.value)}` : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-500 text-sm w-20 pl-4">
                        {row.value > 0 ? `−${row.pct.toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                    {row.note && (
                      <tr>
                        <td colSpan={3} className="pb-2 pl-5 text-xs text-slate-600 italic">{row.note}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-500 mt-1 mb-1" />

            <div className="flex items-end justify-between py-4">
              <div>
                <div className="text-base font-semibold text-white">Net Settlement Amount</div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Effective cost rate: <span className="font-mono text-white">{breakdown.effectiveCostRate.toFixed(2)}%</span></span>
                  <span>·</span>
                  <span>Currency: <span className="font-mono text-white">{settleCurrency}</span></span>
                  <span>·</span>
                  <span>Payout: <span className="text-white">{activePayoutFreq}</span></span>
                </div>
                <div className="text-xs text-slate-600 mt-1.5">
                  Net payout estimate after modelled payment, FX, and treasury assumptions.
                </div>
                {methodNote && (
                  <div className="text-xs text-slate-500 mt-1 italic">{methodNote}</div>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-6">
                <div className="text-3xl font-mono font-bold text-green-400">{money(breakdown.netSettlement)}</div>
                <div className="text-sm font-mono text-green-500/70 mt-0.5">{(100 - breakdown.effectiveCostRate).toFixed(2)}% of gross</div>
              </div>
            </div>

            <div className="mt-1">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, 100 - breakdown.effectiveCostRate)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                <span>Deductions: {breakdown.effectiveCostRate.toFixed(2)}%</span>
                <span className="text-slate-600">{currencyNote}</span>
                <span>Net recovery: {(100 - breakdown.effectiveCostRate).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settlement Date Calculator ─────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
        <div className="text-xs uppercase tracking-widest text-slate-400 mb-4">Settlement &amp; Payout Timeline</div>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-2">Event Close Date</label>
            <input
              type="date" value={eventCloseDate}
              onChange={e => setEventCloseDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {pspSettledDate && selectedMethod && (
            <div className="flex items-start gap-8 flex-wrap">
              <div>
                <div className="text-xs text-slate-500">PSP Settlement Available</div>
                <div className="font-mono font-semibold text-white mt-0.5">
                  {pspSettledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">T+{selectedMethod.settlement} · {selectedMethodName}</div>
              </div>
              {payoutDate && (
                <div>
                  <div className="text-xs text-slate-500">Next Licensee Payout</div>
                  <div className="font-semibold text-green-400 mt-0.5">
                    {isImMor
                      ? 'End of Month'
                      : `Tuesday ${payoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    }
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{activePayoutFreq} · {activeMorDef.icon} {activeMorDef.label}</div>
                </div>
              )}
              <div className={`px-4 py-2.5 rounded-lg border text-center ${
                totalTreasuryExposureDays > 20 ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                totalTreasuryExposureDays > 10 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                'bg-green-500/10 border-green-500/30 text-green-400'
              }`}>
                <div className="text-2xl font-mono font-bold">~{totalTreasuryExposureDays}</div>
                <div className="text-xs">days exposure</div>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
          <div>
            <span className="text-slate-600">Settlement Timing: </span>
            PSP rail T+N — fixed by payment method, not configurable here.
          </div>
          <div>
            <span className="text-slate-600">Payout Frequency: </span>
            MOR disbursement cadence — configurable per MOR model in Admin Config.
          </div>
        </div>
      </div>

      {/* ── Settlement Assumptions collapsible ──────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setAssumptionsOpen(o => !o)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-700/20 transition-colors"
        >
          <span className="text-xs uppercase tracking-widest text-slate-400">Settlement Assumptions</span>
          {assumptionsOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </button>
        {assumptionsOpen && (
          <div className="px-5 pb-5 border-t border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mt-4">
              {[
                { label: 'FX Source', value: 'ECB reference rate via Frankfurter API, fetched at session load' },
                { label: 'Settlement Timing', value: 'PSP rail T+N — excludes weekends. Fixed per payment method, not affected by payout frequency.' },
                { label: 'MOR Model', value: `${activeMorDef.icon} ${activeMorDef.label} — ${activeMorDef.description}` },
                { label: 'Payout Frequency', value: `${activePayoutFreq} — governed by ${activeMorDef.label}. Configurable in Admin Config.` },
                { label: 'Float Cost', value: `${assumptions.settlement.floatCostPct.toFixed(2)}% annual cost of capital — applied to PSP settlement window and payout frequency lag separately` },
                { label: 'Processing Estimates', value: 'Based on contracted PSP rate matrix — dLocal (contracted) and Stripe (published rates)' },
                { label: 'Platform Fee', value: `${assumptions.platform.platformFeePct.toFixed(2)}% TicketSocket registration platform service fee` },
                { label: 'Reserve Assumptions', value: 'Rolling reserves excluded unless explicitly modelled in event configuration' },
                { label: 'BNPL Uplift', value: 'Conversion improvement estimates are directional — substitute observed conversion data where available' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 py-1">
                  <div className="text-xs text-slate-500 w-36 flex-shrink-0 pt-0.5">{item.label}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {fxTimestamp && <p className="text-xs text-slate-500">Calculated using FX rates as of {fxTimestamp}</p>}
      <p className="text-xs text-slate-600 leading-relaxed">
        Settlement Timing reflects PSP rail characteristics. Payout Frequency reflects MOR business rules. Both are modelled assumptions — actual values depend on contracted terms and transaction mix.
      </p>
    </div>
  );
}
