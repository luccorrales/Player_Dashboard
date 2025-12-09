// Main percentile functions registry
// This file loads and combines all category-specific percentile functions

// Import all category percentile modules (these will be loaded via script tags in HTML)
// The functions will be available globally via the percentileFunctions object

const percentileFunctions = {};

// Helper: Calculate percentile from benchmark array
function calculatePercentileFromBenchmarks(value, benchmarks) {
  if (value <= benchmarks[0]) return 0;
  if (value >= benchmarks[benchmarks.length - 1]) return 100;
  
  for (let i = 0; i < benchmarks.length - 1; i++) {
    if (value >= benchmarks[i] && value <= benchmarks[i + 1]) {
      const range = benchmarks[i + 1] - benchmarks[i];
      const position = value - benchmarks[i];
      const percentInRange = position / range;
      const percentileStart = (i / (benchmarks.length - 1)) * 100;
      const percentileEnd = ((i + 1) / (benchmarks.length - 1)) * 100;
      return Math.round(percentileStart + (percentileEnd - percentileStart) * percentInRange);
    }
  }
  return 50;
}

// Helper: Cumulative normal distribution (for IQ and other normally distributed metrics)
function cumulativeNormalDistribution(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

// Helper: Invert percentile for "lower is better" metrics (like race times)
function invertPercentile(percentile) {
  return 100 - percentile;
}

// Note: The actual percentile functions are loaded from category-specific files
// Load order in HTML should be:
// 1. index.js (this file)
// 2. percentile-physical.js
// 3. percentile-cognitive.js
// 4. percentile-financial.js
// 5. percentile-social.js
// 6. percentile-emotional.js
