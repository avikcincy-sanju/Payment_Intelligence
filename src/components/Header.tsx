import React from 'react';

type Tab = 'overview' | 'corridor' | 'compare' | 'settlement' | 'markets' | 'admin' | 'intelligence' | 'scenarios';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  fxTimestamp: string;
  fxError: boolean;
}

const TABS: { id: Tab; label: string; phase?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'corridor', label: 'Corridor' },
  { id: 'compare', label: 'Compare' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'markets', label: 'Markets' },
  { id: 'admin', label: 'Admin Config' },
  { id: 'intelligence', label: 'Intelligence', phase: '2' },
  { id: 'scenarios', label: 'Scenarios', phase: '3' },
];

export default function Header({ activeTab, onTabChange, fxTimestamp, fxError }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700/80">
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-xl font-semibold text-white tracking-tight">Payment Intelligence</h1>
          <p className="text-xs text-slate-400 mt-0.5">Global Athlete Commerce · Cost & Settlement Intelligence</p>
        </div>

        {/* FX status badge */}
        <div className="flex-shrink-0">
          {fxError ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/8 border border-amber-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-400 whitespace-nowrap">Using reference rates</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/8 border border-green-500/20">
              <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span className="text-xs text-green-400 whitespace-nowrap">
                FX rates live · ECB
                {fxTimestamp && (
                  <span className="text-green-500/60 ml-1.5">{fxTimestamp}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <nav className="px-6 flex items-end gap-0 border-t border-slate-800">
        {/* Visibility / Phase 1 group */}
        <div className="flex items-end">
          <span className="text-slate-700 text-xs uppercase tracking-widest mr-3 pb-3 hidden xl:block select-none">Phase 1</span>
          {TABS.filter(t => !t.phase).map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-700/60 mx-3 mb-3 hidden xl:block" />

        {/* Phase 2 */}
        <div className="flex items-end">
          <span className="text-slate-700 text-xs uppercase tracking-widest mr-3 pb-3 hidden xl:block select-none">Phase 2</span>
          {TABS.filter(t => t.phase === '2').map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-700/60 mx-3 mb-3 hidden xl:block" />

        {/* Phase 3 */}
        <div className="flex items-end">
          <span className="text-slate-700 text-xs uppercase tracking-widest mr-3 pb-3 hidden xl:block select-none">Phase 3</span>
          {TABS.filter(t => t.phase === '3').map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
