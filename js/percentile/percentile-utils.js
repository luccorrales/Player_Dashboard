// percentile-utils.js (ES module)

export function calculatePercentileFromBenchmarks(value, benchmarks) {
  if (value <= benchmarks[0]) return 0;
  if (value >= benchmarks[benchmarks.length - 1]) return 100;

  for (let i = 0; i < benchmarks.length - 1; i++) {
    if (value >= benchmarks[i] && value <= benchmarks[i + 1]) {
      const range = benchmarks[i + 1] - benchmarks[i];
      const position = value - benchmarks[i];
      const pctInRange = position / range;
      const pctStart = (i / (benchmarks.length - 1)) * 100;
      const pctEnd = ((i + 1) / (benchmarks.length - 1)) * 100;
      return Math.round(pctStart + (pctEnd - pctStart) * pctInRange);
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
