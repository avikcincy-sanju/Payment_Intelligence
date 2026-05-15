import React, { useState } from 'react';
import { PORTFOLIO_ALERTS, OPTIMIZATIONS, BNPL_MARKETS } from '../data/constants';

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'critical') return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-semibold uppercase tracking-wide">Critical</span>;
  if (severity === 'warning') return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase tracking-wide">Warning</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 font-semibold uppercase tracking-wide">Opportunity</span>;
}

export default function IntelligenceDashboard() {
  const [monthlyVolume, setMonthlyVolume] = useState(100000);

  const combinedAnnual = OPTIMIZATIONS.reduce((sum, o) => {
    const share = monthlyVolume / OPTIMIZATIONS.length;
    return sum + (share * (o.saving_pct / 100) * 12);
  }, 0);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Intelligence Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Portfolio-wide payment optimization insights</p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">
          Phase 2 · Recommendations Engine
        </span>
      </div>

      {/* Section A: Active Alerts */}
      <section>
        <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-4">Active Alerts</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PORTFOLIO_ALERTS.map((alert, i) => {
            const borderColor = alert.severity === 'critical' ? 'border-l-red-500' : alert.severity === 'warning' ? 'border-l-amber-500' : 'border-l-teal-500';
            const actionColor = alert.severity === 'critical' ? 'text-red-400' : alert.severity === 'warning' ? 'text-amber-400' : 'text-teal-400';
            return (
              <div key={i} className={`bg-slate-800 border border-slate-700 border-l-4 ${borderColor} rounded-lg p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{alert.flag}</span>
                    <span className="font-semibold text-white">{alert.market}</span>
                  </div>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <div className="font-semibold text-white mb-2">{alert.title}</div>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">{alert.detail}</p>
                <p className={`text-sm ${actionColor} italic`}>→ Recommended Action: {alert.action}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section B: Optimization Opportunities */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs uppercase tracking-widest text-green-400 font-semibold">Optimization Opportunities</div>
        </div>
        <p className="text-xs text-slate-500 mb-4">Ranked by estimated impact per $500 registration. Switch payment method defaults to recover margin.</p>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">Market</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">Current Default</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">Recommended Switch</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">Cost Saving</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">Settlement</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-normal">Est. Saving / $500</th>
                </tr>
              </thead>
              <tbody>
                {OPTIMIZATIONS.map(opt => (
                  <tr
                    key={opt.rank}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors ${opt.saving_pct >= 3 ? 'border-l-4 border-l-green-500' : ''}`}
                  >
                    <td className="px-4 py-3.5 text-slate-500 font-mono">{opt.rank}</td>
                    <td className="px-4 py-3.5 text-white font-medium">{opt.market}</td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">{opt.current}</td>
                    <td className="px-4 py-3.5 text-green-400 text-xs font-medium">{opt.recommended}</td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      <span className="text-green-400 font-semibold">{opt.saving_pct.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-400 text-xs">{opt.settlement_gain}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-green-400 font-bold">${opt.per_500.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
            * Estimates based on contracted rate data. Annual impact depends on event volume per corridor.
          </div>
        </div>

        {/* Multi-corridor aggregator */}
        <div className="mt-4 bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex-1 min-w-48">
              <label className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Monthly Registration Volume ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={monthlyVolume}
                  onChange={e => setMonthlyVolume(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-1">Combined Annual Optimization Potential</div>
              <div className="text-3xl font-mono font-bold text-green-400">${combinedAnnual.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-slate-500 mt-1">Illustrative — based on entered volume distributed proportionally</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section C: BNPL Opportunity Map */}
      <section>
        <div className="text-xs uppercase tracking-widest text-purple-400 font-semibold mb-1">BNPL Availability Across Portfolio</div>
        <p className="text-xs text-slate-500 mb-4">Buy Now Pay Later options available in 19 markets — evaluate for premium race entries</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {BNPL_MARKETS.map(m => (
            <div key={m.market} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{m.flag}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  m.psp === 'Stripe' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {m.provider}
                </span>
              </div>
              <div className="font-medium text-white text-sm">{m.market}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.psp}</div>
              <div className="text-xs text-slate-400 mt-2">{m.best_for}</div>
              <div className="mt-2">
                {m.status === 'Available'
                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">Available</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">TBC</span>
                }
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">19 markets</span> offer BNPL options —{' '}
            <span className="text-purple-400 font-medium">15 via Klarna through Stripe</span>,{' '}
            <span className="text-teal-400 font-medium">4 via local dLocal providers</span>
          </span>
        </div>
      </section>
    </div>
  );
}
