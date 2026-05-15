import React from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function MethodologyModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="text-lg font-semibold text-white">Methodology & Data Sources</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-7">

          <section>
            <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Live FX Rates</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Sourced from the European Central Bank (ECB) via the Frankfurter open API (<code className="text-sky-400 text-xs bg-slate-900 px-1.5 py-0.5 rounded">api.frankfurter.app</code>). Rates fetched on session load and cached. Base currency: USD. Last updated timestamp displayed in app header. If live rates are unavailable, reference rates are used and flagged with an amber indicator.
            </p>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">PSP Processing Rates — Regional Acquirer (dLocal)</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Based on contracted rate matrix provided by dLocal for this organization's account. Rates are specific to this commercial relationship and may differ from dLocal's standard published pricing. Data verified as of Q1 2026.
            </p>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">PSP Processing Rates — Global Card Network (Stripe)</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Based on Stripe's standard published merchant pricing: 2.9% + $0.30 per transaction for card processing. Adaptive Pricing FX spread: 0.4% (contracted rate for eligible markets). Klarna via Stripe: 3.49% + $0.49 per transaction.
            </p>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Platform Fee</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              TicketSocket registration platform service fee: 1.0% per transaction. Applied uniformly across all corridors where TicketSocket is the registration platform.
            </p>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Settlement Float Cost</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Calculated as: registration amount × (5% annual cost of capital ÷ 365 days) × settlement days. The 5% annual rate reflects a standard treasury cost-of-capital assumption. Payout cycle: weekly, every Tuesday. Average float window: 4.5 days (range 1–7 days depending on day of registration within the week).
            </p>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">BNPL Conversion Assumptions</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Klarna and dLocal BNPL conversion uplift figures on the PSP Comparison screen are user-adjustable inputs, not fixed assumptions. Default values (8% for Adaptive Pricing, 12% for Klarna) reflect directional estimates based on publicly reported BNPL adoption rates in European and LatAm markets. Users are encouraged to substitute their own observed conversion data.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
