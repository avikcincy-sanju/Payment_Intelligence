export const PSP_CONFIG = {
  stripe_standard: {
    name: "Global Card Network — Standard",
    processing_pct: 0.029,
    processing_flat: 0.30,
    fx_spread: 0.015,
    settlement_days: 2,
    platform_fee: 0.01,
    color: "#0ea5e9",
    label: "Stripe Standard"
  },
  stripe_adaptive: {
    name: "Global Card Network — Local Currency Pricing",
    processing_pct: 0.029,
    processing_flat: 0.30,
    fx_spread: 0.004,
    settlement_days: 2,
    platform_fee: 0.01,
    color: "#6366f1",
    label: "Stripe Adaptive Pricing"
  },
  klarna: {
    name: "BNPL — Buy Now Pay Later",
    processing_pct: 0.0349,
    processing_flat: 0.49,
    fx_spread: 0.015,
    settlement_days: 1,
    platform_fee: 0.01,
    color: "#a855f7",
    label: "Klarna via Stripe"
  }
};

export const ADDITIONAL_FEES = {
  threeds: 0.03,
  api_fee: 0.10,
  chargeback_rate: 0.001,
  cost_of_capital_annual: 0.05
};

export const DLOCAL_CORRIDORS: Record<string, DLocalCorridor> = {
  india: {
    country: "India", region: "APAC", currency: "INR", flag: "🇮🇳",
    methods: [
      { name: "Cards", processing: 0.04, fx: 0.01, settlement: 5 },
      { name: "Bank Transfer", processing: 0.03, fx: 0.01, settlement: 4 },
      { name: "UPI", processing: 0.005, fx: 0.01, settlement: 4 }
    ],
    recommended: "UPI", status: "active"
  },
  brazil: {
    country: "Brazil", region: "LATAM", currency: "BRL", flag: "🇧🇷",
    methods: [
      { name: "Cards", processing: 0.035, fx: 0.04, settlement: 5, note: "Indicative" },
      { name: "Pix", processing: 0.01, fx: 0.04, settlement: 3 },
      { name: "Boleto", processing: 0.01, fx: 0.04, settlement: 3 },
      { name: "Pagaleve (BNPL)", processing: 0.035, fx: 0.04, settlement: 5, bnpl: true }
    ],
    recommended: "Pix", status: "active"
  },
  uruguay: {
    country: "Uruguay", region: "LATAM", currency: "UYU", flag: "🇺🇾",
    methods: [
      { name: "Cards", processing: 0.065, fx: 0.01, settlement: 32 },
      { name: "Redpagos", processing: 0.023, fx: 0.01, settlement: 9 },
      { name: "Abitab", processing: 0.07, fx: 0.01, settlement: 32 }
    ],
    recommended: "Redpagos", status: "active", risk: "high"
  },
  argentina: {
    country: "Argentina", region: "LATAM", currency: "ARS", flag: "🇦🇷",
    methods: [
      { name: "Cards", processing: 0.032, fx: 0.02, settlement: 5 },
      { name: "Bank Transfer", processing: 0.005, fx: 0.02, settlement: 5 },
      { name: "Pareto (BNPL)", processing: 0.0, fx: 0.02, settlement: 5, bnpl: true },
      { name: "Modo Wallet", processing: 0.03, fx: 0.02, settlement: 17 }
    ],
    recommended: "Bank Transfer", status: "active", risk: "high"
  },
  chile: {
    country: "Chile", region: "LATAM", currency: "CLP", flag: "🇨🇱",
    methods: [
      { name: "Cards", processing: 0.03, fx: 0.01, settlement: 6 },
      { name: "Khipu", processing: 0.0165, fx: 0.01, settlement: 5 },
      { name: "WebPay", processing: 0.025, fx: 0.01, settlement: 6 },
      { name: "Mercado Pago", processing: 0.0375, fx: 0.01, settlement: 4 }
    ],
    recommended: "Khipu", status: "active"
  },
  peru: {
    country: "Peru", region: "LATAM", currency: "PEN", flag: "🇵🇪",
    methods: [
      { name: "Cards", processing: 0.05, fx: 0.01, settlement: 5 },
      { name: "Bank Transfer", processing: 0.03, fx: 0.01, settlement: 5 },
      { name: "Yape Wallet", processing: 0.03, fx: 0.01, settlement: 5 },
      { name: "PowerPay (BNPL)", processing: 0.035, fx: 0.01, settlement: 5, bnpl: true }
    ],
    recommended: "Bank Transfer", status: "active"
  },
  mexico: {
    country: "Mexico", region: "LATAM", currency: "MXN", flag: "🇲🇽",
    methods: [
      { name: "Cards", processing: 0.032, fx: 0.01, settlement: 3 },
      { name: "SPEI Transfer", processing: 0.01, fx: 0.01, settlement: 1 }
    ],
    recommended: "SPEI Transfer", status: "active"
  },
  costa_rica: {
    country: "Costa Rica", region: "LATAM", currency: "CRC", flag: "🇨🇷",
    methods: [
      { name: "Cards", processing: 0.055, fx: 0.01, settlement: 5 },
      { name: "Bank Transfer", processing: 0.0215, fx: 0.01, settlement: 4 }
    ],
    recommended: "Bank Transfer", status: "active", risk: "high"
  },
  panama: {
    country: "Panama", region: "LATAM", currency: "USD", flag: "🇵🇦",
    methods: [
      { name: "Cards", processing: 0.035, fx: 0, settlement: 3 },
      { name: "Clave", processing: 0.0375, fx: 0, settlement: 22 }
    ],
    recommended: "Cards", status: "active"
  },
  indonesia: {
    country: "Indonesia", region: "APAC", currency: "IDR", flag: "🇮🇩",
    methods: [
      { name: "Cards", processing: 0.04, fx: 0.01, settlement: 10 },
      { name: "Bank Transfer", processing: 0.014, fx: 0.01, settlement: 4 },
      { name: "QRIS", processing: 0.022, fx: 0.01, settlement: 5 },
      { name: "OVO", processing: 0.035, fx: 0.01, settlement: 6 }
    ],
    recommended: "Bank Transfer", status: "active"
  },
  philippines: {
    country: "Philippines", region: "APAC", currency: "PHP", flag: "🇵🇭",
    methods: [
      { name: "Cards", processing: 0.0415, fx: 0.01, settlement: 6 },
      { name: "Virtual Accounts", processing: 0.011, fx: 0.01, settlement: 3 },
      { name: "Wallets", processing: 0.0315, fx: 0.01, settlement: 6 }
    ],
    recommended: "Virtual Accounts", status: "active"
  },
  vietnam: {
    country: "Vietnam", region: "APAC", currency: "VND", flag: "🇻🇳",
    methods: [
      { name: "Cards", processing: 0.035, fx: 0.01, settlement: 2 },
      { name: "Bank Transfer", processing: 0.02, fx: 0.01, settlement: 3 },
      { name: "VietQR", processing: 0.01, fx: 0.01, settlement: 7 }
    ],
    recommended: "Bank Transfer", status: "active"
  },
  thailand: {
    country: "Thailand", region: "APAC", currency: "THB", flag: "🇹🇭",
    methods: [
      { name: "Cards", processing: 0.043, fx: 0.01, settlement: 9 },
      { name: "ThaiQR / PromptPay", processing: 0.01, fx: 0.01, settlement: 9 },
      { name: "TrueMoney", processing: 0.0375, fx: 0.01, settlement: 4 },
      { name: "ShopeePay", processing: 0.0275, fx: 0.01, settlement: 4 }
    ],
    recommended: "ThaiQR / PromptPay", status: "tbd"
  },
  uae: {
    country: "United Arab Emirates", region: "EMEA", currency: "AED", flag: "🇦🇪",
    methods: [
      { name: "Cards", processing: 0.032, fx: 0.02, settlement: 5 }
    ],
    recommended: "Cards", status: "active"
  },
  saudi_arabia: {
    country: "Saudi Arabia", region: "EMEA", currency: "SAR", flag: "🇸🇦",
    methods: [
      { name: "Cards", processing: 0.0375, fx: 0.01, settlement: 14 },
      { name: "Tamara (BNPL)", processing: 0.04, fx: 0.01, settlement: 5, bnpl: true }
    ],
    recommended: "Cards", status: "active", risk: "settlement"
  },
  turkey: {
    country: "Turkey", region: "EMEA", currency: "TRY", flag: "🇹🇷",
    methods: [
      { name: "Cards", processing: 0.05, fx: 0.01, settlement: 4 },
      { name: "Bank Transfer", processing: 0.0175, fx: 0.01, settlement: 4 }
    ],
    recommended: "Bank Transfer", status: "active"
  },
  morocco: {
    country: "Morocco", region: "EMEA", currency: "MAD", flag: "🇲🇦",
    methods: [
      { name: "Cards", processing: 0.03, fx: 0.01, settlement: 2 }
    ],
    recommended: "Cards", status: "active"
  },
  egypt: {
    country: "Egypt", region: "EMEA", currency: "EGP", flag: "🇪🇬",
    methods: [
      { name: "Cards", processing: 0.035, fx: 0.08, settlement: 5 },
      { name: "My Fawry App", processing: 0.03, fx: 0.08, settlement: 5 },
      { name: "Meeza Network", processing: 0.025, fx: 0.08, settlement: 5 }
    ],
    recommended: "Meeza Network", status: "active", risk: "fx"
  }
};

export const STRIPE_MARKETS: Record<string, StripeMarket> = {
  uk:          { country: "United Kingdom",  currency: "GBP", flag: "🇬🇧", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  germany:     { country: "Germany",         currency: "EUR", flag: "🇩🇪", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  france:      { country: "France",          currency: "EUR", flag: "🇫🇷", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  spain:       { country: "Spain",           currency: "EUR", flag: "🇪🇸", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  italy:       { country: "Italy",           currency: "EUR", flag: "🇮🇹", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  austria:     { country: "Austria",         currency: "EUR", flag: "🇦🇹", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  switzerland: { country: "Switzerland",     currency: "CHF", flag: "🇨🇭", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  netherlands: { country: "Netherlands",     currency: "EUR", flag: "🇳🇱", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  sweden:      { country: "Sweden",          currency: "SEK", flag: "🇸🇪", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  denmark:     { country: "Denmark",         currency: "DKK", flag: "🇩🇰", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  portugal:    { country: "Portugal",        currency: "EUR", flag: "🇵🇹", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  luxembourg:  { country: "Luxembourg",      currency: "EUR", flag: "🇱🇺", region: "Europe",   klarna: true,  adaptive: true,  settlement_days: 2 },
  canada:      { country: "Canada",          currency: "CAD", flag: "🇨🇦", region: "Americas", klarna: true,  adaptive: false, settlement_days: 2 },
  new_zealand: { country: "New Zealand",     currency: "NZD", flag: "🇳🇿", region: "APAC",     klarna: true,  adaptive: false, settlement_days: 2 },
  malaysia:    { country: "Malaysia",        currency: "MYR", flag: "🇲🇾", region: "APAC",     klarna: true,  adaptive: false, settlement_days: 2 },
  australia:   { country: "Australia",       currency: "AUD", flag: "🇦🇺", region: "APAC",     klarna: false, adaptive: false, settlement_days: 2 },
  usa:         { country: "United States",   currency: "USD", flag: "🇺🇸", region: "Americas", klarna: false, adaptive: false, settlement_days: 2 }
};

export const PIPELINE_MARKETS: PipelineMarket[] = [
  { country: "Taiwan",      flag: "🇹🇼", region: "APAC", status: "Q4 2026",       psp: "dLocal", currency: "TWD", readiness: 60 },
  { country: "South Korea", flag: "🇰🇷", region: "APAC", status: "Q4 2026",       psp: "dLocal", currency: "KRW", readiness: 60 },
  { country: "Bahrain",     flag: "🇧🇭", region: "EMEA", status: "TBC",           psp: "dLocal", currency: "BHD", readiness: 30 },
  { country: "Oman",        flag: "🇴🇲", region: "EMEA", status: "TBC",           psp: "dLocal", currency: "OMR", readiness: 30 },
  { country: "Qatar",       flag: "🇶🇦", region: "EMEA", status: "TBC",           psp: "dLocal", currency: "QAR", readiness: 30 },
  { country: "Sri Lanka",   flag: "🇱🇰", region: "APAC", status: "Not Supported", psp: "None",   currency: "LKR", readiness: 0  },
  { country: "Serbia",      flag: "🇷🇸", region: "EMEA", status: "Not Supported", psp: "None",   currency: "RSD", readiness: 0  },
  { country: "Israel",      flag: "🇮🇱", region: "EMEA", status: "Not Supported", psp: "None",   currency: "ILS", readiness: 0  }
];

export const WHY_IT_MATTERS: Record<string, string[]> = {
  brazil:       ["Pix reduces collection cost by ~2.8% vs cards with confirmed T+3 settlement", "Lower dispute and chargeback exposure than card transactions", "Recommended default for all athlete registrations", "BNPL available via Pagaleve for high-value race entries"],
  uruguay:      ["T+32 card settlement is the longest treasury delay in the entire portfolio", "All-in card cost of ~7.5% is the highest in Latin America", "Redpagos offers T+9 settlement at significantly lower cost", "Consider alternative payout structures for licensee events in this market"],
  argentina:    ["2% FX fee is the highest in the entire dLocal matrix", "Currency volatility compounds overhead on high-value events", "Bank transfers cost 0.5% processing vs 3.2% for cards — material difference", "Monitor ARS exposure closely; treasury impact can be significant"],
  saudi_arabia: ["T+14 card settlement — second longest delay in the portfolio", "BNPL available via Tamara — worth evaluating for premium race entries", "Market is commercially viable but treasury timing requires advance planning", "Growing triathlon market with strong athlete registration potential"],
  indonesia:    ["T+10 card settlement creates significant cash flow delay for licensee payouts", "Bank transfers settle in T+4 at 1.4% processing — nearly 3x cheaper than cards", "QRIS (QR payment) widely adopted and settles in T+5", "Recommend defaulting to bank transfer or QRIS over cards"],
  india:        ["UPI is the dominant payment method at 0.5% processing — far cheaper than cards", "T+4 settlement across digital rails — operationally clean", "Large and growing endurance event market with international participation", "Strong case for UPI as default with cards as fallback only"],
  turkey:       ["Cards carry 5% processing — highest in the EMEA dLocal portfolio", "Bank transfers cut that to 1.75% for the same T+4 settlement speed", "Currency volatility on TRY requires FX monitoring for large events", "Recommend bank transfer default with cards as secondary option only"],
  costa_rica:   ["Card processing at 5.5% is among the highest in LatAm", "Bank transfers at 2.15% offer same settlement at less than half the cost", "USD is the local transactional currency — no FX conversion risk", "Recommend bank transfer as default for all registration processing"],
  egypt:        ["FX fee of 8% is the highest in the entire dLocal matrix by a significant margin", "Combined with processing, all-in cost can exceed 11% on card transactions", "Meeza Network offers lower processing at 2.5% with same FX overhead", "Treasury should model EGP volatility for all event revenue forecasts"],
  philippines:  ["Virtual accounts offer 1.1% processing with T+3 settlement — lowest cost option", "Cards at 4.15% processing are significantly more expensive", "Growing endurance market with increasing international athlete participation", "Recommend virtual accounts as default payment method"],
  chile:        ["Khipu bank transfer at 1.65% is materially cheaper than cards at 3%", "Mercado Pago widely adopted but carries highest processing cost in the market", "Stable currency with predictable FX behavior — low treasury risk", "Recommend Khipu as default for optimal cost efficiency"],
  peru:         ["Cards at 5% are expensive relative to bank transfers at 3%", "Yape wallet widely adopted and cost-equivalent to bank transfers", "BNPL available via PowerPay — evaluate for premium triathlon entries", "Recommend bank transfer or Yape as default"],
  uae:          ["Cards only currently — 3.2% processing with 2% FX overhead", "T+5 settlement is manageable for event cashflow planning", "UAE is a premium market with high average registration value", "FX fee of 2% is elevated — factor into high-value event P&L forecasts"],
  vietnam:      ["Bank transfers offer lower processing at 2% vs cards at 3.5%", "Cards provide fastest settlement at T+2 if speed is priority", "VietQR available at 1% processing — use for non-time-sensitive flows", "Emerging endurance market with strong regional growth trajectory"],
  uk:           ["Klarna BNPL available — evaluate for premium race entries above £300", "Adaptive Pricing reduces FX friction for non-GBP athletes registering", "Strongest endurance market in Europe by registration volume", "Weekly Tuesday payout cycle — plan event cashflow accordingly"],
  germany:      ["Klarna adoption highest in Europe — strong conversion case for BNPL", "Adaptive Pricing materially improves checkout for non-EU athletes", "EUR settlement eliminates conversion cost entirely for EUR-based events", "Both Klarna and Adaptive Pricing worth enabling for this market"],
  france:       ["Klarna available but adoption lower than Germany and Nordics", "Adaptive Pricing recommended for events attracting international athletes", "EUR settlement — clean treasury flow with no conversion overhead", "Evaluate Klarna on event-by-event basis based on entry price point"]
};

export const DEFAULT_WHY_MATTERS = [
  "Review all-in cost against portfolio average before enabling this corridor",
  "Settlement timing should be factored into event cashflow planning",
  "Compare available payment methods to identify lowest-cost default",
  "Confirm FX exposure with treasury before high-value event launches"
];

export const PORTFOLIO_ALERTS: PortfolioAlert[] = [
  { severity: "critical", market: "Uruguay", flag: "🇺🇾",
    title: "Extreme Settlement Delay",
    detail: "Card settlements in Uruguay take T+32 days — the longest delay in the entire portfolio. Treasury cash flow impact is material for licensee events.",
    action: "Switch to Redpagos (T+9) to recover 23 days of settlement timing and reduce cost from 7.5% to 3.3% all-in." },
  { severity: "critical", market: "Egypt", flag: "🇪🇬",
    title: "Elevated FX Exposure",
    detail: "Egypt carries an 8% FX fee — the highest in the entire dLocal matrix. Combined with processing, all-in cost exceeds 11% on card transactions.",
    action: "Route to Meeza Network to reduce processing cost. Model EGP volatility in all event revenue forecasts." },
  { severity: "warning", market: "Saudi Arabia", flag: "🇸🇦",
    title: "Long Settlement Window",
    detail: "Card settlements take T+14 days. For events with near-term payout obligations this creates a treasury gap.",
    action: "Factor T+14 into event cashflow planning. Evaluate Tamara BNPL for premium race entries." },
  { severity: "warning", market: "Argentina", flag: "🇦🇷",
    title: "High FX Overhead",
    detail: "Argentina carries a 2% FX fee across all payment methods — second highest in the portfolio. ARS currency volatility amplifies exposure.",
    action: "Default to bank transfers at 0.5% processing to minimize total cost. Monitor ARS exposure on high-value events." },
  { severity: "warning", market: "Costa Rica", flag: "🇨🇷",
    title: "High Processing Cost",
    detail: "Card processing at 5.5% is among the highest in LatAm. Bank transfers offer the same settlement speed at 2.15% processing.",
    action: "Switch default to bank transfer. Estimated saving: ~3.35% per registration — approximately $16.75 per $500 entry." },
  { severity: "warning", market: "Indonesia", flag: "🇮🇩",
    title: "Card Settlement Delay + Cost",
    detail: "Cards take T+10 and cost 5% all-in. Bank transfers settle in T+4 at 2.4% — significantly cheaper and faster.",
    action: "Default to bank transfer or QRIS over cards for all Indonesian athlete registrations." },
  { severity: "opportunity", market: "Brazil", flag: "🇧🇷",
    title: "Pix Optimization Available",
    detail: "Pix costs ~5% all-in with confirmed T+3 settlement and lower dispute exposure than cards.",
    action: "Confirm Pix as default payment method for all Brazilian athlete registrations." },
  { severity: "opportunity", market: "Europe — 13 markets", flag: "🇪🇺",
    title: "Adaptive Pricing & Klarna Unquantified",
    detail: "13 European markets are eligible for Adaptive Pricing and/or Klarna. Revenue uplift from both remains unquantified at portfolio level.",
    action: "Run per-market simulations in the PSP Comparison screen to build the approval business case." }
];

export const OPTIMIZATIONS: Optimization[] = [
  { rank: 1, market: "Uruguay 🇺🇾",     current: "Cards — 7.5% all-in, T+32", recommended: "Redpagos — 3.3% all-in, T+9",         saving_pct: 4.2,  settlement_gain: "23 days faster", per_500: 21.00,  note: "Largest combined cost + treasury impact in portfolio" },
  { rank: 2, market: "India 🇮🇳",       current: "Cards — 5.0% all-in, T+5",  recommended: "UPI — 1.5% all-in, T+4",               saving_pct: 3.5,  settlement_gain: "1 day faster",   per_500: 17.50,  note: "UPI dominant in market — low switching friction" },
  { rank: 3, market: "Costa Rica 🇨🇷",  current: "Cards — 6.5% all-in, T+5",  recommended: "Bank Transfer — 3.15% all-in, T+4",    saving_pct: 3.35, settlement_gain: "1 day faster",   per_500: 16.75,  note: "USD market — no FX risk on switch" },
  { rank: 4, market: "Turkey 🇹🇷",      current: "Cards — 6.0% all-in, T+4",  recommended: "Bank Transfer — 2.75% all-in, T+4",    saving_pct: 3.25, settlement_gain: "Same speed",     per_500: 16.25,  note: "Same settlement speed at less than half the processing cost" },
  { rank: 5, market: "Philippines 🇵🇭", current: "Cards — 5.15% all-in, T+6", recommended: "Virtual Accounts — 2.1% all-in, T+3",  saving_pct: 3.05, settlement_gain: "3 days faster",  per_500: 15.25,  note: "Fastest AND cheapest option in this market" },
  { rank: 6, market: "Indonesia 🇮🇩",   current: "Cards — 5.0% all-in, T+10", recommended: "Bank Transfer — 2.4% all-in, T+4",     saving_pct: 2.6,  settlement_gain: "6 days faster",  per_500: 13.00,  note: "Major settlement timing benefit in addition to cost saving" },
  { rank: 7, market: "Chile 🇨🇱",       current: "Cards — 4.0% all-in, T+6",  recommended: "Khipu — 2.65% all-in, T+5",            saving_pct: 1.35, settlement_gain: "1 day faster",   per_500: 6.75,   note: "Khipu widely adopted — low friction to switch" },
  { rank: 8, market: "Vietnam 🇻🇳",     current: "Cards — 4.5% all-in, T+2",  recommended: "Bank Transfer — 3.0% all-in, T+3",     saving_pct: 1.5,  settlement_gain: "1 day slower",   per_500: 7.50,   note: "Cost saving at slight settlement speed trade-off" }
];

export const BNPL_MARKETS: BNPLMarket[] = [
  { market: "United Kingdom",  flag: "🇬🇧", provider: "Klarna",   psp: "Stripe", best_for: "Entries above £300",     status: "Available" },
  { market: "Germany",         flag: "🇩🇪", provider: "Klarna",   psp: "Stripe", best_for: "All premium entries",     status: "Available" },
  { market: "France",          flag: "🇫🇷", provider: "Klarna",   psp: "Stripe", best_for: "Entries above €350",      status: "Available" },
  { market: "Spain",           flag: "🇪🇸", provider: "Klarna",   psp: "Stripe", best_for: "Entries above €300",      status: "Available" },
  { market: "Italy",           flag: "🇮🇹", provider: "Klarna",   psp: "Stripe", best_for: "Entries above €300",      status: "Available" },
  { market: "Austria",         flag: "🇦🇹", provider: "Klarna",   psp: "Stripe", best_for: "Entries above €300",      status: "Available" },
  { market: "Switzerland",     flag: "🇨🇭", provider: "Klarna",   psp: "Stripe", best_for: "Entries above CHF 350",   status: "Available" },
  { market: "Netherlands",     flag: "🇳🇱", provider: "Klarna",   psp: "Stripe", best_for: "All premium entries",     status: "Available" },
  { market: "Sweden",          flag: "🇸🇪", provider: "Klarna",   psp: "Stripe", best_for: "All entries",             status: "Available" },
  { market: "Denmark",         flag: "🇩🇰", provider: "Klarna",   psp: "Stripe", best_for: "All entries",             status: "Available" },
  { market: "Portugal",        flag: "🇵🇹", provider: "Klarna",   psp: "Stripe", best_for: "Entries above €300",      status: "Available" },
  { market: "Luxembourg",      flag: "🇱🇺", provider: "Klarna",   psp: "Stripe", best_for: "All premium entries",     status: "Available" },
  { market: "Canada",          flag: "🇨🇦", provider: "Klarna",   psp: "Stripe", best_for: "Entries above CAD 400",   status: "Available" },
  { market: "New Zealand",     flag: "🇳🇿", provider: "Klarna",   psp: "Stripe", best_for: "Entries above NZD 500",   status: "Available" },
  { market: "Malaysia",        flag: "🇲🇾", provider: "Klarna",   psp: "Stripe", best_for: "Entries above MYR 800",   status: "Available" },
  { market: "Brazil",          flag: "🇧🇷", provider: "Pagaleve", psp: "dLocal", best_for: "High-value triathlon entries", status: "Available" },
  { market: "Peru",            flag: "🇵🇪", provider: "PowerPay", psp: "dLocal", best_for: "Premium entries",         status: "Available" },
  { market: "Argentina",       flag: "🇦🇷", provider: "Pareto",   psp: "dLocal", best_for: "All entries",             status: "Available" },
  { market: "Saudi Arabia",    flag: "🇸🇦", provider: "Tamara",   psp: "dLocal", best_for: "Premium entries",         status: "TBC" }
];

// --- Type definitions ---

export interface PaymentMethod {
  name: string;
  processing: number;
  fx: number;
  settlement: number;
  note?: string;
  bnpl?: boolean;
}

export interface DLocalCorridor {
  country: string;
  region: string;
  currency: string;
  flag: string;
  methods: PaymentMethod[];
  recommended: string;
  status: "active" | "tbd";
  risk?: "high" | "settlement" | "fx";
}

export interface StripeMarket {
  country: string;
  currency: string;
  flag: string;
  region: string;
  klarna: boolean;
  adaptive: boolean;
  settlement_days: number;
}

export interface PipelineMarket {
  country: string;
  flag: string;
  region: string;
  status: string;
  psp: string;
  currency: string;
  readiness: number;
}

export interface PortfolioAlert {
  severity: "critical" | "warning" | "opportunity";
  market: string;
  flag: string;
  title: string;
  detail: string;
  action: string;
}

export interface Optimization {
  rank: number;
  market: string;
  current: string;
  recommended: string;
  saving_pct: number;
  settlement_gain: string;
  per_500: number;
  note: string;
}

export interface BNPLMarket {
  market: string;
  flag: string;
  provider: string;
  psp: string;
  best_for: string;
  status: string;
}
