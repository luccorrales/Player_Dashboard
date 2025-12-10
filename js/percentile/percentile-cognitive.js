// percentile-cognitive.js

percentileFunctions.iq_percentile = (value) => {
  const mean = 100;
  const sd = 15;
  const z = (value - mean) / sd;
  // cumulativeNormalDistribution is globally available from index.js
  return Math.round(cumulativeNormalDistribution(z) * 100);
};

// Add other cognitive percentile functions here
