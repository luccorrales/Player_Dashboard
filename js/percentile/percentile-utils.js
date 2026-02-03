// percentile-utils.js (ES module)

// CRITICAL: The benchmarks correspond to these percentile points, NOT linear spacing
const PERC_POINTS = [1, 10, 25, 50, 75, 90, 99];

export function calculatePercentileFromBenchmarks(value, benchmarks) {
  if (value <= benchmarks[0]) return PERC_POINTS[0];
  if (value >= benchmarks[benchmarks.length - 1]) return PERC_POINTS[benchmarks.length - 1];

  for (let i = 0; i < benchmarks.length - 1; i++) {
    if (value >= benchmarks[i] && value <= benchmarks[i + 1]) {
      const range = benchmarks[i + 1] - benchmarks[i];
      const position = value - benchmarks[i];
      const pctInRange = position / range;
      
      // Use actual percentile points, not linear index mapping
      const pctStart = PERC_POINTS[i];
      const pctEnd = PERC_POINTS[i + 1];
      
      return pctStart + (pctEnd - pctStart) * pctInRange;
    }
  }

  return 50;
}

export function cumulativeNormalDistribution(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t *
      (-0.3565638 +
        t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return z > 0 ? 1 - prob : prob;
}

export function invertPercentile(percentile) {
  return 100 - percentile;
}