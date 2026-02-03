// percentile-financial.js
// Deterministic percentile ↔ net worth model
// Log-normal body + Pareto upper tail
// Monotonic by construction

import { percentileFunctions } from './registry.js';

/* ----------------------------
   Math helpers
----------------------------- */

// Inverse error function (Winitzki approximation)
// Accurate enough for percentile mapping
function erfinv(x) {
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + ln / 2;
  const term2 = ln / a;
  return Math.sign(x) * Math.sqrt(Math.sqrt(term1 * term1 - term2) - term1);
}

// Error function (needed for CDF)
function erf(x) {
  // Abramowitz and Stegun approximation
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return sign * y;
}

// CDF of log-normal distribution
function lognormalCDF(x, mu, sigma) {
  if (x <= 0) return 0;
  const z = (Math.log(x) - mu) / (sigma * Math.sqrt(2));
  return 0.5 * (1 + erf(z));
}

// Inverse CDF of log-normal distribution
function lognormalInv(u, mu, sigma) {
  // Clamp to avoid infinities
  const eps = 1e-6;
  const uc = Math.min(Math.max(u, eps), 1 - eps);
  return Math.exp(
    mu + sigma * Math.sqrt(2) * erfinv(2 * uc - 1)
  );
}

// CDF of Pareto (Type I)
function paretoCDF(x, alpha, scale) {
  if (x < scale) return 0;
  return 1 - Math.pow(scale / x, alpha);
}

// Inverse CDF of Pareto (Type I)
function paretoInv(u, alpha, scale) {
  const eps = 1e-6;
  const uc = Math.min(Math.max(u, eps), 1 - eps);
  return scale / Math.pow(1 - uc, 1 / alpha);
}

/* ----------------------------
   Model parameters
   (Canada / Quebec oriented)
----------------------------- */

const PARAMS = {
  "20s": {
    mu: 10.2,      // median ~27k
    sigma: 1.8,
    alpha: 2.3,
    scale: 200_000
  },
  "30s": {
    mu: 11.4,      // median ~90k
    sigma: 1.45,
    alpha: 2.0,
    scale: 600_000
  },
  "40s": {
    mu: 12.1,      // median ~180k
    sigma: 1.25,
    alpha: 1.85,
    scale: 1_000_000
  },
  "50s": {
    mu: 12.6,      // median ~300k
    sigma: 1.1,
    alpha: 1.75,
    scale: 1_600_000
  },
  "60s": {
    mu: 12.7,      // median ~330k
    sigma: 1.05,
    alpha: 1.7,
    scale: 2_000_000
  }
};

/* ----------------------------
   Helper: Map age to age group
----------------------------- */
function getAgeGroup(age) {
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60s";
}

/* ----------------------------
   Public API
----------------------------- */

// Forward: percentile → net worth
export function netWorthFromPercentile(percentile, ageGroup) {
  const p = PARAMS[ageGroup];
  if (!p) {
    throw new Error(`Unknown age group: ${ageGroup}`);
  }

  const u = percentile / 100;

  // Bottom 99%: log-normal body
  if (u < 0.99) {
    return lognormalInv(u / 0.99, p.mu, p.sigma);
  }

  // Top 1%: Pareto tail
  const tailU = (u - 0.99) / 0.01;
  return paretoInv(tailU, p.alpha, p.scale);
}

// Inverse: net worth → percentile
function networth_percentile(value, age) {
  const ageGroup = getAgeGroup(age || 30);
  const p = PARAMS[ageGroup];
  
  if (!p) {
    console.warn(`Unknown age group for age ${age}`);
    return 50; // Default to median
  }

  // Transition point between log-normal and Pareto
  const transition = paretoInv(0, p.alpha, p.scale);
  
  // Bottom 99%: log-normal body
  if (value < transition) {
    const cdf = lognormalCDF(value, p.mu, p.sigma);
    return Math.max(0, Math.min(99, cdf * 99));
  }

  // Top 1%: Pareto tail
  const tailCDF = paretoCDF(value, p.alpha, p.scale);
  const percentile = 99 + tailCDF * 1;
  
  return Math.max(0, Math.min(100, percentile));
}

// Income percentile (simplified US-based model)
function income_percentile(value) {
  // Simplified income percentile breakpoints (US data, approximate)
  const incomeBreakpoints = [
    { percentile: 10, income: 15000 },
    { percentile: 20, income: 27000 },
    { percentile: 30, income: 40000 },
    { percentile: 40, income: 52000 },
    { percentile: 50, income: 68000 },
    { percentile: 60, income: 85000 },
    { percentile: 70, income: 105000 },
    { percentile: 80, income: 130000 },
    { percentile: 90, income: 180000 },
    { percentile: 95, income: 250000 },
    { percentile: 99, income: 500000 }
  ];

  // Handle edge cases
  if (value <= incomeBreakpoints[0].income) {
    return Math.max(0, (value / incomeBreakpoints[0].income) * incomeBreakpoints[0].percentile);
  }
  
  if (value >= incomeBreakpoints[incomeBreakpoints.length - 1].income) {
    return Math.min(100, 99 + (value - incomeBreakpoints[incomeBreakpoints.length - 1].income) / 500000);
  }

  // Linear interpolation between breakpoints
  for (let i = 0; i < incomeBreakpoints.length - 1; i++) {
    const lower = incomeBreakpoints[i];
    const upper = incomeBreakpoints[i + 1];
    
    if (value >= lower.income && value <= upper.income) {
      const ratio = (value - lower.income) / (upper.income - lower.income);
      return lower.percentile + ratio * (upper.percentile - lower.percentile);
    }
  }
  
  return 50; // Default fallback
}

// Register functions in the global registry
percentileFunctions.networth_percentile = networth_percentile;
percentileFunctions.income_percentile = income_percentile;