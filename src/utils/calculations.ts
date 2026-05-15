import { ADDITIONAL_FEES } from '../data/constants';

export interface CostBreakdown {
  processingCost: number;
  fxCost: number;
  floatCost: number;
  platformCost: number;
  additionalFixed: number;
  totalCost: number;
  netReceived: number;
  totalPct: number;
}

export interface CostOverrides {
  floatCostAnnualPct?: number;
  platformFeePct?: number;
}

export function calculateCost(
  amount: number,
  processingPct: number,
  processingFlat: number = 0,
  fxFee: number,
  settlementDays: number,
  platformFeePct: number = 0.01,
  overrides?: CostOverrides
): CostBreakdown {
  const floatRate = overrides?.floatCostAnnualPct != null
    ? overrides.floatCostAnnualPct / 100
    : ADDITIONAL_FEES.cost_of_capital_annual;
  const platFee = overrides?.platformFeePct != null
    ? overrides.platformFeePct / 100
    : platformFeePct;
  const processingCost = amount * processingPct + processingFlat;
  const fxCost = amount * fxFee;
  const floatCost = amount * (floatRate / 365) * settlementDays;
  const platformCost = amount * platFee;
  const additionalFixed = ADDITIONAL_FEES.threeds + ADDITIONAL_FEES.api_fee;
  const totalCost = processingCost + fxCost + floatCost + platformCost + additionalFixed;
  const netReceived = amount - totalCost;
  const totalPct = (totalCost / amount) * 100;
  return { processingCost, fxCost, floatCost, platformCost, additionalFixed, totalCost, netReceived, totalPct };
}

export function readinessScore(methods: { processing: number; fx: number; settlement: number }[]): number {
  const best = methods.reduce((b, m) => (m.processing + m.fx < b.processing + b.fx ? m : b));
  let score = 85;

  // Settlement penalty
  if (best.settlement > 20) score -= 30;
  else if (best.settlement > 10) score -= 20;
  else if (best.settlement > 5) score -= 10;

  // All-in cost penalty
  const allIn = best.processing + best.fx;
  if (allIn > 0.08) score -= 25;
  else if (allIn > 0.06) score -= 18;
  else if (allIn > 0.04) score -= 10;

  // FX fee penalty
  if (best.fx >= 0.08) score -= 25;
  else if (best.fx >= 0.02) score -= 10;

  // Method count
  if (methods.length < 2) score -= 8;
  else if (methods.length >= 3) score += 8;

  // Bonus: fast settlement
  if (best.settlement <= 3) score += 5;

  // Bonus: local low-cost rail under 2% processing
  if (best.processing <= 0.02) score += 8;

  return Math.max(0, Math.min(100, score));
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(n: number): string {
  return n.toFixed(2) + '%';
}

export function formatMoney(value: number, currency: 'USD' | 'EUR' = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function convertDisplay(valueUsd: number, currency: 'USD' | 'EUR', fxRates: Record<string, number>): number {
  if (currency === 'EUR') {
    return valueUsd * (fxRates.EUR || 0.92);
  }
  return valueUsd;
}

export function nextTuesdayAfterSettlement(eventCloseDate: Date, settlementDays: number): Date {
  const settled = new Date(eventCloseDate);
  settled.setDate(settled.getDate() + settlementDays);
  // Find next Tuesday (day 2)
  const day = settled.getDay();
  const daysUntilTuesday = day <= 2 ? 2 - day : 9 - day;
  settled.setDate(settled.getDate() + (daysUntilTuesday === 0 ? 7 : daysUntilTuesday));
  return settled;
}
