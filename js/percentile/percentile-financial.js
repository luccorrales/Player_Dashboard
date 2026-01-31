// percentile-financial.js

function pareto(u, alpha, scale) {
  return scale / Math.pow(1 - u, 1 / alpha);
}

function lognormal(u, mu, sigma) {
  // Box–Muller transform
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * u);
  return Math.exp(mu + sigma * z);
}

const PARAMS = {
  "20s": { mu: 11.2, sigma: 1.45, alpha: 2.2, scale: 250_000 },
  "30s": { mu: 12.0, sigma: 1.30, alpha: 2.0, scale: 600_000 },
  "40s": { mu: 12.7, sigma: 1.15, alpha: 1.85, scale: 1_000_000 },
  "50s": { mu: 13.2, sigma: 1.05, alpha: 1.75, scale: 1_800_000 },
  "60s": { mu: 13.3, sigma: 1.00, alpha: 1.70, scale: 2_200_000 },
};

export function netWorthFromPercentile(percentile, ageGroup) {
  const p = PARAMS[ageGroup];
  const u = percentile / 100;

  // Bottom 98% → log-normal
  if (u < 0.98) {
    return lognormal(u / 0.98, p.mu, p.sigma);
  }

  // Top 2% → Pareto tail
  const tailU = (u - 0.98) / 0.02;
  return pareto(tailU, p.alpha, p.scale);
}
