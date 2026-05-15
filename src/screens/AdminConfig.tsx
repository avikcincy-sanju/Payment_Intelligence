import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Download, FileText, Check, X, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Copy, Save, RotateCcw, Plus, Eye,
  Wifi, WifiOff, Database, Zap, RefreshCw,
} from 'lucide-react';
import {
  useAssumptions,
  DEFAULT_ASSUMPTIONS,
  type GlobalAssumptions,
  type PayoutFrequency,
  type MorPayoutConfig,
} from '../context/AssumptionsContext';
import { calculateCost } from '../utils/calculations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedEvent {
  name: string;
  country: string;
  registrations: number;
  avgTicket: number;
  currency: string;
  date: string;
}

interface Scenario {
  id: string;
  name: string;
  assumptions: GlobalAssumptions;
  createdAt: string;
}

type ApiConnStatus = 'idle' | 'checking' | 'connected' | 'error';

// ─── Sample CSV ───────────────────────────────────────────────────────────────

const SAMPLE_CSV = `Event Name,Country,Registrations,Average Ticket Price,Currency,Event Date
IRONMAN 70.3 São Paulo,Brazil,1200,420,USD,2026-03-15
IRONMAN World Championship,USA,2500,850,USD,2026-10-12
IRONMAN 70.3 Buenos Aires,Argentina,800,380,USD,2026-04-20
IRONMAN 70.3 Edinburgh,United Kingdom,1100,390,USD,2026-06-08
IRONMAN 70.3 Melbourne,Australia,950,410,USD,2026-11-22
IRONMAN 70.3 Bahrain,Bahrain,600,450,USD,2026-12-07
IRONMAN 70.3 Cascais,Portugal,1050,360,USD,2026-09-14
IRONMAN 70.3 Yokohama,Japan,750,480,USD,2026-05-17`;

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: 's1',
    name: 'LATAM MOR Model',
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      fxSpreads: { ...DEFAULT_ASSUMPTIONS.fxSpreads, dLocalLocal: 0.80 },
    },
    createdAt: '2026-04-12',
  },
  {
    id: 's2',
    name: 'Brazil Pix Optimization',
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      platform: { ...DEFAULT_ASSUMPTIONS.platform, platformFeePct: 0.85 },
    },
    createdAt: '2026-04-18',
  },
  {
    id: 's3',
    name: 'Adaptive Pricing Pilot',
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      fxSpreads: { ...DEFAULT_ASSUMPTIONS.fxSpreads, stripeAdaptive: 0.30 },
    },
    createdAt: '2026-05-02',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt2(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCSV(text: string): UploadedEvent[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(s => s.trim());
    return {
      name:          cols[0] || '',
      country:       cols[1] || '',
      registrations: parseInt(cols[2] || '0', 10),
      avgTicket:     parseFloat(cols[3] || '0'),
      currency:      cols[4] || 'USD',
      date:          cols[5] || '',
    };
  }).filter(e => e.name);
}

/**
 * Compute Brazil/Pix impact at $500 for side-by-side diff preview.
 * Pix: processingPct=1%, flat=0, fxFee=4%, settlementDays=3, platformFeePct=1%
 */
function computePreviewImpact(a: GlobalAssumptions) {
  return calculateCost(
    500,
    0.01,
    0,
    0.04,
    3,
    0.01,
    {
      floatCostAnnualPct: a.settlement.floatCostPct,
      platformFeePct: a.platform.platformFeePct,
    },
  );
}

// ─── Slider row ───────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step = 0.05, suffix = '%',
  onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm text-slate-400 w-36 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 min-w-0 overflow-hidden">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full accent-sky-500 h-1.5 block"
        />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs font-mono text-white text-right focus:outline-none focus:border-sky-500"
        />
        <span className="text-xs text-slate-500 w-3">{suffix}</span>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AdminConfig({ fxTimestamp }: { fxTimestamp: string }) {
  const { assumptions, setAssumptions, resetAssumptions } = useAssumptions();

  // Draft for the assumptions panel — only applied on Save
  const [draft, setDraft] = useState<GlobalAssumptions>(assumptions);
  const [assumptionsSaved, setAssumptionsSaved] = useState(false);

  // Simulate-before-save preview (change 1)
  const [showPreview, setShowPreview] = useState(false);

  // API connectivity status (change 3)
  const [apiConnStatus, setApiConnStatus] = useState<ApiConnStatus>('idle');

  // CSV upload state
  const [uploadedEvents, setUploadedEvents] = useState<UploadedEvent[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scenario management
  const [scenarios, setScenarios] = useState<Scenario[]>(SAMPLE_SCENARIOS);
  const [saveScenarioName, setSaveScenarioName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Section collapse state
  const [showArch, setShowArch] = useState(false);

  // Keep draft in sync if assumptions change externally (e.g. scenario load)
  useEffect(() => {
    setDraft(assumptions);
  }, [assumptions]);

  // ── CSV helpers ─────────────────────────────────────────────────────────────

  function handleFileRead(text: string) {
    const events = parseCSV(text);
    if (events.length > 0) {
      setUploadedEvents(events);
      setUploadSuccess(true);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleFileRead(ev.target?.result as string);
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleFileRead(ev.target?.result as string);
    reader.readAsText(file);
  }, []);

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_events.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Assumption helpers ──────────────────────────────────────────────────────

  function patchFx(key: keyof typeof draft.fxSpreads, v: number) {
    setDraft(d => ({ ...d, fxSpreads: { ...d.fxSpreads, [key]: v } }));
  }
  function patchSettlement(key: keyof typeof draft.settlement, v: number) {
    setDraft(d => ({ ...d, settlement: { ...d.settlement, [key]: v } }));
  }
  function patchMorPayout(key: keyof MorPayoutConfig, v: PayoutFrequency) {
    setDraft(d => ({ ...d, morPayout: { ...d.morPayout, [key]: v } }));
  }
  function patchPlatform(key: keyof typeof draft.platform, v: number | boolean) {
    setDraft(d => ({ ...d, platform: { ...d.platform, [key]: v } }));
  }

  function saveAssumptions() {
    setAssumptions(draft);
    setShowPreview(false);
    setAssumptionsSaved(true);
    setTimeout(() => setAssumptionsSaved(false), 3000);
  }

  function resetAll() {
    setDraft(DEFAULT_ASSUMPTIONS);
    resetAssumptions();
    setShowPreview(false);
  }

  // ── API connectivity test (change 3) ────────────────────────────────────────

  function testConnection() {
    setApiConnStatus('checking');
    setTimeout(() => setApiConnStatus('connected'), 1000);
  }

  // ── Scenario helpers ────────────────────────────────────────────────────────

  function saveScenario() {
    if (!saveScenarioName.trim()) return;
    const s: Scenario = {
      id: Date.now().toString(),
      name: saveScenarioName.trim(),
      assumptions: { ...assumptions },
      createdAt: new Date().toISOString().split('T')[0],
    };
    setScenarios(prev => [s, ...prev]);
    setSaveScenarioName('');
    setShowSaveInput(false);
  }

  function duplicateScenario(s: Scenario) {
    const dup: Scenario = { ...s, id: Date.now().toString(), name: s.name + ' (Copy)', createdAt: new Date().toISOString().split('T')[0] };
    setScenarios(prev => [...prev, dup]);
  }

  function loadScenario(s: Scenario) {
    setAssumptions(s.assumptions);
    setDraft(s.assumptions);
  }

  function exportCSV() {
    const rows = [
      ['Scenario', 'Stripe Standard FX%', 'Adaptive FX%', 'dLocal Cards FX%', 'dLocal Local FX%', 'Klarna FX%', 'Float Cost%', 'Platform Fee%'],
      ...scenarios.map(s => [
        s.name,
        s.assumptions.fxSpreads.stripeStandard,
        s.assumptions.fxSpreads.stripeAdaptive,
        s.assumptions.fxSpreads.dLocalCards,
        s.assumptions.fxSpreads.dLocalLocal,
        s.assumptions.fxSpreads.klarna,
        s.assumptions.settlement.floatCostPct,
        s.assumptions.platform.platformFeePct,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenario_snapshots.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Change 4: Export scenarios as JSON
  function exportJSON() {
    const data = scenarios.map(s => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      assumptions: s.assumptions,
    }));
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenario_snapshots.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Derived upload stats ────────────────────────────────────────────────────

  const totalRegs = uploadedEvents.reduce((s, e) => s + e.registrations, 0);
  const grossRev  = uploadedEvents.reduce((s, e) => s + e.registrations * e.avgTicket, 0);
  const activeMarkets = new Set(uploadedEvents.map(e => e.country)).size;

  // ── Preview diff helpers ─────────────────────────────────────────────────────

  // Build flat list of changed assumption rows for the diff table
  type DiffRow = { label: string; current: string; proposed: string; changed: boolean };

  function buildDiffRows(): DiffRow[] {
    const rows: DiffRow[] = [
      { label: 'Stripe Standard FX %',   current: fmt2(assumptions.fxSpreads.stripeStandard), proposed: fmt2(draft.fxSpreads.stripeStandard),   changed: assumptions.fxSpreads.stripeStandard !== draft.fxSpreads.stripeStandard },
      { label: 'Stripe Adaptive FX %',   current: fmt2(assumptions.fxSpreads.stripeAdaptive), proposed: fmt2(draft.fxSpreads.stripeAdaptive),   changed: assumptions.fxSpreads.stripeAdaptive !== draft.fxSpreads.stripeAdaptive },
      { label: 'dLocal Cards FX %',      current: fmt2(assumptions.fxSpreads.dLocalCards),    proposed: fmt2(draft.fxSpreads.dLocalCards),      changed: assumptions.fxSpreads.dLocalCards !== draft.fxSpreads.dLocalCards },
      { label: 'dLocal Local FX %',      current: fmt2(assumptions.fxSpreads.dLocalLocal),    proposed: fmt2(draft.fxSpreads.dLocalLocal),      changed: assumptions.fxSpreads.dLocalLocal !== draft.fxSpreads.dLocalLocal },
      { label: 'Klarna FX %',            current: fmt2(assumptions.fxSpreads.klarna),         proposed: fmt2(draft.fxSpreads.klarna),           changed: assumptions.fxSpreads.klarna !== draft.fxSpreads.klarna },
      { label: 'Float Cost % p.a.',      current: fmt2(assumptions.settlement.floatCostPct),  proposed: fmt2(draft.settlement.floatCostPct),    changed: assumptions.settlement.floatCostPct !== draft.settlement.floatCostPct },
      { label: 'Platform Fee %',         current: fmt2(assumptions.platform.platformFeePct),  proposed: fmt2(draft.platform.platformFeePct),    changed: assumptions.platform.platformFeePct !== draft.platform.platformFeePct },
      { label: 'Reserve %',              current: fmt2(assumptions.platform.reservePct),      proposed: fmt2(draft.platform.reservePct),        changed: assumptions.platform.reservePct !== draft.platform.reservePct },
      { label: 'Chargeback Buffer %',    current: fmt2(assumptions.platform.chargebackBufferPct), proposed: fmt2(draft.platform.chargebackBufferPct), changed: assumptions.platform.chargebackBufferPct !== draft.platform.chargebackBufferPct },
    ];
    return rows;
  }

  const diffRows = buildDiffRows();
  const hasChanges = diffRows.some(r => r.changed);

  const currentImpact  = computePreviewImpact(assumptions);
  const proposedImpact = computePreviewImpact(draft);
  const netDelta       = proposedImpact.netReceived - currentImpact.netReceived;
  const netDeltaPct    = currentImpact.netReceived !== 0
    ? (netDelta / currentImpact.netReceived) * 100
    : 0;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Screen title + microcopy */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">Phase 1 MVP Configuration</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Operational control center for the Payment Intelligence platform. Configure assumptions, upload event data, and manage scenario snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-500">Phase 1 Standalone MVP</span>
          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-500">Internal Treasury Simulation Tool</span>
        </div>
      </div>

      {/* ── Section 1: Event Data Upload ─────────────────────────────────────── */}
      <section>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-semibold">Event Data Upload</div>
        <p className="text-xs text-slate-500 mb-4">Upload event-level registration data to simulate corridor economics and treasury outcomes.</p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Drop zone */}
          <div className="lg:col-span-3">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-colors px-6 py-8 flex flex-col items-center justify-center gap-3 ${
                dragOver
                  ? 'border-sky-500 bg-sky-500/5'
                  : uploadSuccess
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              {uploadSuccess ? (
                <>
                  <CheckCircle size={28} className="text-green-500" />
                  <div className="text-center">
                    <div className="text-sm font-semibold text-green-400">{uploadedEvents.length} events uploaded successfully</div>
                    <div className="text-xs text-slate-500 mt-0.5">Click or drag to replace</div>
                  </div>
                </>
              ) : (
                <>
                  <Upload size={24} className={dragOver ? 'text-sky-400' : 'text-slate-500'} />
                  <div className="text-center">
                    <div className="text-sm text-slate-300">Drop CSV file here or <span className="text-sky-400">click to upload</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">Event Name · Country · Registrations · Avg Ticket · Currency · Date</div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Upload size={13} />
                Upload CSV
              </button>
              <button
                onClick={downloadSample}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-600"
              >
                <Download size={13} />
                Download Sample CSV
              </button>
            </div>
          </div>

          {/* Summary tiles */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
            {[
              { label: 'Total Events',    value: uploadedEvents.length || '—' },
              { label: 'Registrations',   value: totalRegs > 0 ? totalRegs.toLocaleString() : '—' },
              { label: 'Gross Revenue',   value: grossRev > 0 ? `$${(grossRev / 1000).toFixed(0)}k` : '—' },
              { label: 'Active Markets',  value: activeMarkets > 0 ? activeMarkets : '—' },
            ].map(tile => (
              <div key={tile.label} className="bg-slate-800 border border-slate-700 rounded-lg p-3.5">
                <div className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">{tile.label}</div>
                <div className="text-xl font-mono font-bold text-white">{tile.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Change 5: Events uploaded banner */}
        {uploadedEvents.length > 0 && (
          <div className="mt-3 flex items-start gap-2.5 bg-green-500/10 border border-green-500/25 rounded-lg px-4 py-3">
            <CheckCircle size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-300 leading-relaxed">
              <span className="font-semibold">{uploadedEvents.length} events uploaded.</span>{' '}
              Switch to the Scenario Modeler to simulate cashflow for these events.
            </p>
          </div>
        )}

        {/* Uploaded events preview */}
        {uploadedEvents.length > 0 && (
          <div className="mt-4 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-medium">Uploaded Events</span>
              <button
                onClick={() => { setUploadedEvents([]); setUploadSuccess(false); }}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <X size={11} /> Clear
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Event', 'Country', 'Registrations', 'Avg Ticket', 'Revenue'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs uppercase tracking-widest text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadedEvents.slice(0, 6).map((ev, i) => (
                    <tr key={i} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-3 text-slate-200 text-sm">{ev.name}</td>
                      <td className="px-5 py-3 text-slate-400 text-sm">{ev.country}</td>
                      <td className="px-5 py-3 font-mono text-slate-300 text-sm">{ev.registrations.toLocaleString()}</td>
                      <td className="px-5 py-3 font-mono text-slate-300 text-sm">${fmt2(ev.avgTicket)}</td>
                      <td className="px-5 py-3 font-mono text-green-400 text-sm font-semibold">
                        ${((ev.registrations * ev.avgTicket) / 1000).toFixed(0)}k
                      </td>
                    </tr>
                  ))}
                  {uploadedEvents.length > 6 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-2 text-xs text-slate-500 text-center">
                        + {uploadedEvents.length - 6} more events
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 2: Editable Assumptions ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Editable Assumptions</div>
            <p className="text-xs text-slate-600 mt-1">Business-managed operational assumptions used across simulations and recommendations. Changes apply across all screens on save.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
            >
              <RotateCcw size={11} /> Reset
            </button>
            {/* Change 1: Preview button */}
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                showPreview
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : hasChanges
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
              }`}
            >
              <Eye size={11} /> Preview
              {hasChanges && !showPreview && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              )}
            </button>
            <button
              onClick={saveAssumptions}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                assumptionsSaved
                  ? 'bg-green-500 text-white'
                  : 'bg-sky-500 hover:bg-sky-400 text-white'
              }`}
            >
              {assumptionsSaved ? <><Check size={11} /> Saved</> : <><Save size={11} /> Save Assumptions</>}
            </button>
          </div>
        </div>

        {/* Change 2: Propagation toast — enhanced message */}
        {assumptionsSaved && (
          <div className="mb-4 flex items-center gap-2.5 bg-green-500/12 border border-green-500/30 rounded-lg px-4 py-3 animate-pulse-once">
            <CheckCircle size={15} className="text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-300">
              <span className="font-semibold">Changes propagated to all screens.</span>{' '}
              Updated in Settlement Calculator, Scenario Modeler, and Corridor screens.
            </p>
          </div>
        )}

        {/* Change 1: Simulate-before-save preview panel */}
        {showPreview && (
          <div className="mb-4 bg-slate-800 border border-amber-500/30 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={13} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-widest">Simulate Changes — Preview</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Side-by-side diff table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-2.5 text-xs uppercase tracking-widest text-slate-500 font-medium">Assumption</th>
                    <th className="text-right px-5 py-2.5 text-xs uppercase tracking-widest text-slate-500 font-medium">Current (Saved)</th>
                    <th className="text-right px-5 py-2.5 text-xs uppercase tracking-widest text-slate-500 font-medium">Proposed (Draft)</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map(row => (
                    <tr
                      key={row.label}
                      className={`border-b border-slate-700/40 transition-colors ${
                        row.changed
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-slate-700/20'
                      }`}
                    >
                      <td className={`px-5 py-2.5 font-medium ${row.changed ? 'text-amber-200' : 'text-slate-400'}`}>
                        {row.label}
                        {row.changed && (
                          <span className="ml-2 text-xs text-amber-500 font-normal">changed</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-slate-400">{row.current}%</td>
                      <td className={`px-5 py-2.5 text-right font-mono font-semibold ${row.changed ? 'text-amber-300' : 'text-slate-400'}`}>
                        {row.proposed}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Preview Impact section — Brazil/Pix at $500 */}
            <div className="px-5 py-4 bg-slate-900/60 border-t border-slate-700">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Preview Impact — Brazil / Pix at $500</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                  <div className="text-xs text-slate-500 mb-1">Current net received</div>
                  <div className="text-base font-mono font-bold text-slate-200">${fmt2(currentImpact.netReceived)}</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                  <div className="text-xs text-amber-500 mb-1">Proposed net received</div>
                  <div className="text-base font-mono font-bold text-amber-300">${fmt2(proposedImpact.netReceived)}</div>
                </div>
                <div className={`rounded-lg px-4 py-3 border ${
                  netDelta > 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : netDelta < 0
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-slate-800 border-slate-700'
                }`}>
                  <div className="text-xs text-slate-500 mb-1">Change</div>
                  <div className={`text-base font-mono font-bold ${
                    netDelta > 0 ? 'text-green-400' : netDelta < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {netDelta >= 0 ? '+' : ''}${fmt2(netDelta)}{' '}
                    <span className="text-sm">({netDelta >= 0 ? '+' : ''}{netDeltaPct.toFixed(2)}%)</span>
                  </div>
                </div>
              </div>
              {!hasChanges && (
                <p className="text-xs text-slate-600 mt-3">No changes detected — draft matches saved assumptions.</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* FX Spread Assumptions */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 overflow-hidden">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-4 font-medium">FX Spread Assumptions</div>
            <div className="space-y-4">
              <SliderRow label="Stripe Standard"      value={draft.fxSpreads.stripeStandard} min={0} max={4}   onChange={v => patchFx('stripeStandard', v)} />
              <SliderRow label="Adaptive Pricing"     value={draft.fxSpreads.stripeAdaptive} min={0} max={2}   onChange={v => patchFx('stripeAdaptive', v)} />
              <SliderRow label="dLocal — Cards"       value={draft.fxSpreads.dLocalCards}    min={0} max={5}   onChange={v => patchFx('dLocalCards', v)} />
              <SliderRow label="dLocal — Local Rails" value={draft.fxSpreads.dLocalLocal}    min={0} max={5}   onChange={v => patchFx('dLocalLocal', v)} />
              <SliderRow label="Klarna"               value={draft.fxSpreads.klarna}         min={0} max={4}   onChange={v => patchFx('klarna', v)} />
            </div>
          </div>

          {/* Settlement Timing Assumptions */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 overflow-hidden">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-1 font-medium">Settlement Timing</div>
            <p className="text-xs text-slate-600 mb-4">PSP rail T+N — fixed per payment method. Not configurable here; sourced from PSP contracts.</p>
            <div className="space-y-4">
              <SliderRow
                label="Float Cost % p.a."
                value={draft.settlement.floatCostPct}
                min={0} max={15} step={0.25}
                onChange={v => patchSettlement('floatCostPct', v)}
              />
            </div>
            <div className="mt-5 space-y-2">
              <div className="text-xs text-slate-500 mb-2">PSP Settlement Windows (reference)</div>
              {[
                { label: 'Pix (Brazil)',          value: 'T+3' },
                { label: 'Cards (most markets)',  value: 'T+5 – T+9' },
                { label: 'Saudi Arabia',           value: 'T+14' },
                { label: 'Uruguay Cards',          value: 'T+32' },
                { label: 'Stripe Markets',         value: 'T+2' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{r.label}</span>
                  <span className="font-mono text-slate-400">{r.value}</span>
                </div>
              ))}
              <p className="text-xs text-slate-700 pt-1">Source: PSP contracted rate matrix. Edit in data/constants.ts.</p>
            </div>
          </div>

          {/* Platform Assumptions */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 overflow-hidden">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-4 font-medium">Platform Assumptions</div>
            <div className="space-y-4">
              <SliderRow
                label="Platform Fee %"
                value={draft.platform.platformFeePct}
                min={0} max={3} step={0.05}
                onChange={v => patchPlatform('platformFeePct', v)}
              />
              <SliderRow
                label="Reserve %"
                value={draft.platform.reservePct}
                min={0} max={5} step={0.05}
                onChange={v => patchPlatform('reservePct', v)}
              />
              <SliderRow
                label="Chargeback Buffer %"
                value={draft.platform.chargebackBufferPct}
                min={0} max={2} step={0.01}
                onChange={v => patchPlatform('chargebackBufferPct', v)}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Include Refund Impact</span>
                <button
                  onClick={() => patchPlatform('includeRefundImpact', !draft.platform.includeRefundImpact)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    draft.platform.includeRefundImpact ? 'bg-sky-500' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    draft.platform.includeRefundImpact ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MOR Payout Frequency — full-width row */}
        {/* Change 6: Show live (saved) values next to each model card */}
        <div className="mt-4 bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 font-medium">Payout Frequency by MOR Model</div>
              <p className="text-xs text-slate-600 mt-1">
                Controls how often funds are disbursed to the licensee or platform account. Independent of PSP settlement timing.
                Changes propagate to the Settlement Calculator and Scenario Modeler.
                Select one of the 3 MOR models: IM as MOR, Licensee as MOR, or Owned Events.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* IM as MOR — fixed monthly */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏢</span>
                  <div className="text-xs font-medium text-slate-300">IM as MOR</div>
                </div>
                {/* Change 6: live value chip */}
                <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 font-medium">
                  Current: {assumptions.morPayout.imMor}
                </span>
              </div>
              <div className="text-xs text-slate-600 mb-3">IRONMAN collects payments and remits to licensee. Fixed monthly — non-configurable.</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-500 border border-slate-600 cursor-not-allowed">
                  Monthly (Fixed)
                </span>
              </div>
            </div>

            {/* Licensee as MOR */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤝</span>
                  <div className="text-xs font-medium text-slate-300">Licensee as MOR</div>
                </div>
                {/* Change 6: live value chip */}
                <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 font-medium">
                  Current: {assumptions.morPayout.licenseeMor}
                </span>
              </div>
              <div className="text-xs text-slate-600 mb-3">Licensee collects payments directly. IM receives platform fees only. Fully configurable.</div>
              <div className="flex flex-wrap gap-1.5">
                {(['Daily', 'Weekly', 'Bi-weekly', 'Monthly'] as PayoutFrequency[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => patchMorPayout('licenseeMor', opt)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      draft.morPayout.licenseeMor === opt
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:text-white border border-slate-600'
                    }`}
                  >{opt}</button>
                ))}
              </div>
            </div>

            {/* Owned Events */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">⭐</span>
                  <div className="text-xs font-medium text-slate-300">Owned Events</div>
                </div>
                {/* Change 6: live value chip */}
                <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 font-medium">
                  Current: {assumptions.morPayout.ownedEvent}
                </span>
              </div>
              <div className="text-xs text-slate-600 mb-3">IM-owned events with fully centralized processing and direct settlement. Configurable cadence.</div>
              <div className="flex flex-wrap gap-1.5">
                {(['Daily', 'Weekly', 'Bi-weekly', 'Monthly'] as PayoutFrequency[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => patchMorPayout('ownedEvent', opt)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      draft.morPayout.ownedEvent === opt
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:text-white border border-slate-600'
                    }`}
                  >{opt}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 mt-3">Indicative assumptions only · No live settlement execution occurs in this application</p>
      </section>

      {/* ── Section 3: Scenario Management ───────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Scenario Snapshots</div>
            <p className="text-xs text-slate-600 mt-1">Save and compare assumption sets across modelling scenarios.</p>
          </div>
          <div className="flex gap-2">
            {/* Change 4: Export CSV + Export JSON buttons */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
            >
              <Download size={11} /> Export CSV
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
            >
              <FileText size={11} /> Export JSON
            </button>
            <button
              onClick={() => setShowSaveInput(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-500/60 rounded-lg transition-colors"
            >
              <Plus size={11} /> Save Scenario
            </button>
          </div>
        </div>

        {showSaveInput && (
          <div className="mb-3 flex items-center gap-2 bg-slate-800 border border-sky-500/30 rounded-lg px-4 py-3">
            <FileText size={13} className="text-sky-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={saveScenarioName}
              onChange={e => setSaveScenarioName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveScenario(); if (e.key === 'Escape') setShowSaveInput(false); }}
              placeholder="Scenario name…"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
            />
            <button onClick={saveScenario} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
            <button onClick={() => setShowSaveInput(false)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {scenarios.map(s => (
            <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 group hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-medium text-white">{s.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.createdAt}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
                <div className="text-xs text-slate-500">Stripe FX</div>
                <div className="text-xs font-mono text-slate-300">{s.assumptions.fxSpreads.stripeStandard.toFixed(2)}%</div>
                <div className="text-xs text-slate-500">Adaptive FX</div>
                <div className="text-xs font-mono text-slate-300">{s.assumptions.fxSpreads.stripeAdaptive.toFixed(2)}%</div>
                <div className="text-xs text-slate-500">Platform Fee</div>
                <div className="text-xs font-mono text-slate-300">{s.assumptions.platform.platformFeePct.toFixed(2)}%</div>
                <div className="text-xs text-slate-500">Float Cost</div>
                <div className="text-xs font-mono text-slate-300">{s.assumptions.settlement.floatCostPct.toFixed(2)}%</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadScenario(s)}
                  className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 rounded transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => duplicateScenario(s)}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  title="Duplicate"
                >
                  <Copy size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: System Status ─────────────────────────────────────────── */}
      {/* Change 3: Replaced MVP readiness with detailed System Status panel */}
      <section>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-semibold">System Status</div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">

          {/* FX API row — with last fetch timestamp and Test Connection button */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <Wifi size={15} className={apiConnStatus === 'connected' ? 'text-green-400' : 'text-slate-500'} />
              <div>
                <div className="text-sm text-slate-300">FX API</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {fxTimestamp
                    ? `Last fetch: ${fxTimestamp} · ECB reference`
                    : 'Not connected · ECB reference'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {apiConnStatus === 'connected' && (
                <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  Connected
                </span>
              )}
              {apiConnStatus === 'checking' && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                  <RefreshCw size={11} className="animate-spin" />
                  Checking...
                </span>
              )}
              {apiConnStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                  <WifiOff size={11} />
                  Error
                </span>
              )}
              <button
                onClick={testConnection}
                disabled={apiConnStatus === 'checking'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={11} className={apiConnStatus === 'checking' ? 'animate-spin' : ''} />
                Test Connection
              </button>
            </div>
          </div>

          {/* Data Store row */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <Database size={15} className="text-slate-500" />
              <div>
                <div className="text-sm text-slate-300">Data Store</div>
                <div className="text-xs text-slate-500 mt-0.5">In-memory (session only)</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/12 text-amber-400 border border-amber-500/25">
              Session Only
            </span>
          </div>

          {/* Scenario Engine row */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <Zap size={15} className="text-green-400" />
              <div>
                <div className="text-sm text-slate-300">Scenario Engine</div>
                <div className="text-xs text-slate-500 mt-0.5">Save · Load · Export · Propagate</div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/12 text-green-400 border border-green-500/25">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Active
            </span>
          </div>

          {/* CSV Upload row */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <Upload size={15} className="text-green-400" />
              <div>
                <div className="text-sm text-slate-300">CSV Upload</div>
                <div className="text-xs text-slate-500 mt-0.5">Browser memory · session only</div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/12 text-green-400 border border-green-500/25">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Enabled
            </span>
          </div>

          {/* PSP APIs row */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <AlertCircle size={15} className="text-slate-600" />
              <div>
                <div className="text-sm text-slate-500">PSP APIs</div>
                <div className="text-xs text-slate-600 mt-0.5">Read-only feed · Phase 2</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-500 border border-slate-600">
              Future Phase
            </span>
          </div>

          {/* Real Settlement Data row */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={15} className="text-slate-600" />
              <div>
                <div className="text-sm text-slate-500">Real Settlement Data</div>
                <div className="text-xs text-slate-600 mt-0.5">Phase 2 integration</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-500 border border-slate-600">
              Future Phase
            </span>
          </div>
        </div>
      </section>

      {/* ── Section 5: Architecture Visual ───────────────────────────────────── */}
      <section>
        <button
          onClick={() => setShowArch(v => !v)}
          className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 hover:text-slate-300 transition-colors w-full text-left"
        >
          Phase 1 Architecture
          {showArch ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showArch && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-0 mb-5 flex-wrap">
              {[
                { label: 'FX API',                       sub: 'ECB / Frankfurter',               color: 'border-green-500/30 text-green-400' },
                { label: 'Admin Data Store',              sub: 'Corridors · Fees · Markets',      color: 'border-sky-500/30 text-sky-400' },
                { label: 'Assumptions Layer',             sub: 'Editable by business owners',     color: 'border-amber-500/30 text-amber-400' },
                { label: 'Payment Intelligence Engine',   sub: 'Calculations · Recommendations',  color: 'border-teal-500/30 text-teal-400' },
                { label: 'Internal Users',                sub: 'Treasury · Payments · Finance',   color: 'border-slate-500/30 text-slate-300' },
              ].map((node, idx, arr) => (
                <React.Fragment key={node.label}>
                  <div className={`flex flex-col items-center justify-center text-center bg-slate-900 border rounded-lg px-4 py-3 min-w-40 ${node.color}`}>
                    <span className="text-sm font-semibold leading-tight">{node.label}</span>
                    <span className="text-xs text-slate-500 mt-0.5">{node.sub}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="text-slate-600 font-mono text-xl px-2 sm:rotate-0 rotate-90 my-1 sm:my-0">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="bg-slate-700/30 rounded-lg px-5 py-3.5 border border-slate-600/50">
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                Phase 1 remains standalone and read-only from production PSP systems.
                No payment processing, routing, or settlement execution occurs inside this tool.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Footer microcopy */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-700 pb-4">
        <span>Indicative assumptions only</span>
        <span>No live settlement execution occurs in this application</span>
        <span>Phase 1 Standalone MVP</span>
      </div>

    </div>
  );
}
