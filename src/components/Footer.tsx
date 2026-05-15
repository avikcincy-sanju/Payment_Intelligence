import React, { useState } from 'react';
import MethodologyModal from './MethodologyModal';

export default function Footer() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-800 bg-slate-900 mt-12">
        <div className="px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span><span className="text-slate-400 font-medium">Phase 1</span> · VISIBILITY · <span className="text-sky-500">Active</span> · Screens 1–5 · Corridor intelligence, PSP comparison, settlement calculation, market readiness</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span><span className="text-slate-400 font-medium">Phase 2</span> · RECOMMENDATIONS · <span className="text-sky-500">Active</span> · Screen 6 · Portfolio alerts, optimization opportunities, BNPL opportunity map</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-3">
              <div className="relative w-2 h-2">
                <span className="w-2 h-2 rounded-full bg-amber-500/40 block absolute inset-0" />
                <span className="w-1 h-2 rounded-l-full bg-amber-500 block absolute left-0 top-0" />
              </div>
              <span><span className="text-slate-400 font-medium">Phase 3</span> · ORCHESTRATION · <span className="text-amber-500">Preview</span> · Screen 7 · Rail shift modeling, new market simulation, event cashflow timeline</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-slate-500 hover:text-slate-400 hover:underline transition-colors"
            >
              Methodology & Data Sources
            </button>
          </div>
        </div>
      </footer>
      {showModal && <MethodologyModal onClose={() => setShowModal(false)} />}
    </>
  );
}
