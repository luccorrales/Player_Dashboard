// percentile-physical.js
import {
  calculatePercentileFromBenchmarks,
  cumulativeNormalDistribution,
} from "./percentile-utils.js";

// export const physicalPercentiles = {
//   bench_press_percentile(weight, age, bodyweight) {
//     const ratio = weight / bodyweight;
//     const ageFactor = age < 30 ? 1 : age < 40 ? 0.95 : age < 50 ? 0.9 : 0.85;
//     const adjustedRatio = ratio / ageFactor;
//     const benchmarks = [0, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
//     return calculatePercentileFromBenchmarks(adjustedRatio, benchmarks);
//   },

  strength_ratio_percentile(weight, bodyweight) {
    const ratio = weight / bodyweight;
    const benchmarks = [0, 0.3, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    return calculatePercentileFromBenchmarks(ratio, benchmarks);
  },

  run_5k_percentile(minutes, age, gender) {
    const isMale = gender === "male";
    const ageFactor =
      age < 30 ? 1 : age < 40 ? 0.95 : age < 50 ? 0.9 : 0.85;

    const benchmarks = isMale
      ? [40, 30, 25, 22, 20, 18, 16]
      : [45, 35, 30, 27, 24, 21, 19];

    const adjusted = benchmarks.map((b) => b / ageFactor);
    const pct = 100 - calculatePercentileFromBenchmarks(minutes, adjusted);
    return Math.max(0, Math.min(100, pct));
  },
};
