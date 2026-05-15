import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Overview from './screens/Overview';
import CorridorDeepDive from './screens/CorridorDeepDive';
import PSPComparison from './screens/PSPComparison';
import SettlementCalculator from './screens/SettlementCalculator';
import MarketReadiness from './screens/MarketReadiness';
import AdminConfig from './screens/AdminConfig';
import IntelligenceDashboard from './screens/IntelligenceDashboard';
import ScenarioModeler from './screens/ScenarioModeler';

type Tab = 'overview' | 'corridor' | 'compare' | 'settlement' | 'markets' | 'admin' | 'intelligence' | 'scenarios';

const FALLBACK_RATES: Record<string, number> = {
  GBP: 0.79, EUR: 0.92, AUD: 1.53, CAD: 1.36, NZD: 1.63,
  BRL: 4.97, MXN: 17.2, ARS: 870, CLP: 897, PEN: 3.71,
  UYU: 39.5, CRC: 518, PAB: 1.0,
  IDR: 15680, PHP: 56.4, THB: 35.1, MYR: 4.71, VND: 24850, INR: 83.4,
  AED: 3.67, SAR: 3.75, TRY: 32.1, MAD: 10.0, EGP: 47.5,
  TWD: 32.1, KRW: 1340, BHD: 0.377, OMR: 0.385, QAR: 3.64,
  CHF: 0.90, DKK: 6.88, SEK: 10.42
};

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-slate-800 border border-slate-700" />
        ))}
      </div>
      <div className="h-96 rounded-lg bg-slate-800 border border-slate-700" />
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [fxTimestamp, setFxTimestamp] = useState('');
  const [fxError, setFxError] = useState(false);
  const [fxLoading, setFxLoading] = useState(true);
  const [pendingCorridorKey, setPendingCorridorKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch('https://api.frankfurter.app/latest?from=USD')
      .then(r => r.json())
      .then(data => {
        setFxRates(data.rates);
        setFxTimestamp(data.date);
        setFxLoading(false);
      })
      .catch(() => {
        setFxError(true);
        setFxRates(FALLBACK_RATES);
        setFxTimestamp(new Date().toISOString().split('T')[0]);
        setFxLoading(false);
      });
  }, []);

  function navigateToCorridor(key: string) {
    setPendingCorridorKey(key);
    setActiveTab('corridor');
  }

  function handleTabChange(tab: Tab) {
    if (tab !== 'corridor') setPendingCorridorKey(undefined);
    setActiveTab(tab);
  }

  const renderScreen = () => {
    if (fxLoading) return <SkeletonLoader />;

    switch (activeTab) {
      case 'overview':
        return <Overview fxRates={fxRates} onNavigateToCorridor={navigateToCorridor} />;
      case 'corridor':
        return <CorridorDeepDive fxRates={fxRates} fxTimestamp={fxTimestamp} initialCorridor={pendingCorridorKey} />;
      case 'compare':
        return <PSPComparison fxRates={fxRates} fxTimestamp={fxTimestamp} />;
      case 'settlement':
        return <SettlementCalculator fxRates={fxRates} fxTimestamp={fxTimestamp} />;
      case 'markets':
        return <MarketReadiness />;
      case 'admin':
        return <AdminConfig fxTimestamp={fxTimestamp} />;
      case 'intelligence':
        return <IntelligenceDashboard />;
      case 'scenarios':
        return <ScenarioModeler fxTimestamp={fxTimestamp} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        fxTimestamp={fxTimestamp}
        fxError={fxError}
      />

      <main className="flex-1 px-6 py-6 max-w-screen-2xl mx-auto w-full">
        {renderScreen()}
      </main>

      <Footer />
    </div>
  );
}
