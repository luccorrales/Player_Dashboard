// percentile-cognitive.js (ES module)
import { percentileFunctions } from './registry.js';
import { cumulativeNormalDistribution } from './percentile-utils.js';

percentileFunctions.iq_percentile = (value) => {
  const mean = 100;
  const sd = 15;
  const z = (value - mean) / sd;
  return Math.round(cumulativeNormalDistribution(z) * 100);
};

// Add other cognitive percentile functions here
