import React, { createContext, useContext, useState } from 'react';

export interface FxSpreads {
  stripeStandard: number;
  stripeAdaptive: number;
  dLocalCards: number;
  dLocalLocal: number;
  klarna: number;
}

export interface SettlementAssumptions {
  floatCostPct: number;
}

export interface PlatformAssumptions {
  platformFeePct: number;
  reservePct: number;
  includeRefundImpact: boolean;
  chargebackBufferPct: number;
}

export type PayoutFrequency = 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly';

// The 3 supported MOR models
export type MorModel = 'im_mor' | 'licensee_mor' | 'owned_event';

export interface MorModelDef {
  key: MorModel;
  label: string;
  icon: string;
  description: string;
}

export const MOR_MODELS: MorModelDef[] = [
  {
    key: 'im_mor',
    label: 'IM as MOR',
    icon: '🏢',
    description: 'IRONMAN collects payments and remits to licensee after deducting platform fees.',
  },
  {
    key: 'licensee_mor',
    label: 'Licensee as MOR',
    icon: '🤝',
    description: 'Licensee collects payments directly; IM only receives platform fees.',
  },
  {
    key: 'owned_event',
    label: 'Owned Events',
    icon: '⭐',
    description: 'IM-owned events with fully centralized processing and direct settlement.',
  },
];

export interface MorPayoutConfig {
  // IM as MOR: fixed monthly, non-configurable
  imMor: 'Monthly';
  // Licensee as MOR: fully configurable
  licenseeMor: PayoutFrequency;
  // Owned Events: configurable, defaults to weekly
  ownedEvent: PayoutFrequency;
}

export interface GlobalAssumptions {
  fxSpreads: FxSpreads;
  settlement: SettlementAssumptions;
  platform: PlatformAssumptions;
  morPayout: MorPayoutConfig;
}

const DEFAULTS: GlobalAssumptions = {
  fxSpreads: {
    stripeStandard: 1.50,
    stripeAdaptive: 0.40,
    dLocalCards:    1.00,
    dLocalLocal:    1.00,
    klarna:         1.50,
  },
  settlement: {
    floatCostPct: 5.00,
  },
  platform: {
    platformFeePct:       1.00,
    reservePct:           0.00,
    includeRefundImpact:  false,
    chargebackBufferPct:  0.10,
  },
  morPayout: {
    imMor:       'Monthly',
    licenseeMor: 'Weekly',
    ownedEvent:  'Weekly',
  },
};

interface AssumptionsCtx {
  assumptions: GlobalAssumptions;
  setAssumptions: React.Dispatch<React.SetStateAction<GlobalAssumptions>>;
  resetAssumptions: () => void;
}

const AssumptionsContext = createContext<AssumptionsCtx>({
  assumptions: DEFAULTS,
  setAssumptions: () => {},
  resetAssumptions: () => {},
});

export function AssumptionsProvider({ children }: { children: React.ReactNode }) {
  const [assumptions, setAssumptions] = useState<GlobalAssumptions>(DEFAULTS);
  function resetAssumptions() { setAssumptions(DEFAULTS); }
  return (
    <AssumptionsContext.Provider value={{ assumptions, setAssumptions, resetAssumptions }}>
      {children}
    </AssumptionsContext.Provider>
  );
}

export function useAssumptions() {
  return useContext(AssumptionsContext);
}

export { DEFAULTS as DEFAULT_ASSUMPTIONS };

export function payoutFrequencyToDays(freq: PayoutFrequency): number {
  switch (freq) {
    case 'Daily':     return 1;
    case 'Weekly':    return 7;
    case 'Bi-weekly': return 14;
    case 'Monthly':   return 30;
  }
}

export function activeMorPayoutFrequency(
  morModel: MorModel,
  morPayout: MorPayoutConfig,
): PayoutFrequency {
  switch (morModel) {
    case 'im_mor':       return morPayout.imMor;
    case 'licensee_mor': return morPayout.licenseeMor;
    case 'owned_event':  return morPayout.ownedEvent;
  }
}
