// percentile-financial.js

percentileFunctions.networth_percentile = (value, age) => {
  const ageGroup = Math.floor(age / 10) * 10;
  const benchmarks = {
    20: [0, 5000, 15000, 50000, 100000],
    30: [0, 20000, 50000, 150000, 300000],
    40: [0, 50000, 150000, 400000, 800000],
    50: [0, 100000, 300000, 750000, 1500000],
    60: [0, 200000, 500000, 1200000, 2500000],
  };
  const bench = benchmarks[ageGroup] || benchmarks[30];
  return calculatePercentileFromBenchmarks(value, bench);
};

percentileFunctions.income_percentile = (value) => {
  const benchmarks = [0, 25000, 40000, 60000, 85000, 120000, 180000, 300000];
  return calculatePercentileFromBenchmarks(value, benchmarks);
};
