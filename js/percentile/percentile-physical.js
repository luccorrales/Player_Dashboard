// percentile-physical.js (ES module)
import { percentileFunctions } from "./registry.js";
import { calculatePercentileFromBenchmarks } from "./percentile-utils.js";

/* ----------------------------
   Age bands (must match Python)
----------------------------- */
function getAgeFactor(age) {
  if (age < 26) return 1.0;
  if (age < 36) return 0.97;
  if (age < 46) return 0.93;
  if (age < 56) return 0.87;
  return 0.80;
}

/* ----------------------------
   BW scaling (general population)
----------------------------- */
function bwAdjustment(bodyweight) {
  return Math.pow(180 / bodyweight, 0.12);
}

/* ----------------------------
   Percentile anchors
----------------------------- */
const PERC_POINTS = [1, 10, 25, 50, 75, 90, 99];

/* ----------------------------
   Base 1RM ratios @ ~180 lb BW
   (General male population)
----------------------------- */
const BASE_RATIOS = {
  bench_press:      [0.20, 0.35, 0.50, 0.60, 0.75, 0.95, 1.25],
  squat:            [0.30, 0.50, 0.70, 0.85, 1.05, 1.30, 1.70],
  deadlift:         [0.35, 0.55, 0.80, 0.95, 1.20, 1.50, 1.90],
  shoulder_press:   [0.12, 0.22, 0.35, 0.45, 0.60, 0.75, 0.95],
  lat_pulldown:     [0.25, 0.40, 0.55, 0.65, 0.80, 0.95, 1.20],
  seated_row_close: [0.30, 0.45, 0.60, 0.70, 0.85, 1.00, 1.25],
  seated_row_wide:  [0.25, 0.40, 0.55, 0.65, 0.80, 0.95, 1.20],
};

/* ----------------------------
   Isolation lifts (absolute 1RM @ ~135 lb BW)
----------------------------- */
const ISOLATION_BASE = {
  lateral_raise:    [5, 8, 12, 15, 20, 25, 35],
  bicep_curl:       [15, 25, 35, 45, 60, 75, 95],
  tricep_extension: [20, 30, 45, 55, 70, 90, 115],
  leg_extension:    [40, 70, 100, 130, 170, 220, 300],
  leg_curl:         [30, 60, 90, 120, 150, 190, 250],
};

/* ----------------------------
   Log-space interpolation helper
----------------------------- */
function logInterpolateBenchmarks(value, benchmarks) {
  const logBench = benchmarks.map(Math.log);
  const logValue = Math.log(value);

  return calculatePercentileFromBenchmarks(logValue, logBench);
}

/* ----------------------------
   Compound lift percentile (1RM)
----------------------------- */
function compoundLiftPercentile(metric, oneRM, age, bodyweight) {
  const ageFactor = getAgeFactor(age);
  const bwAdj = bwAdjustment(bodyweight);

  // normalize to reference population
  const normalizedRatio =
    oneRM / (bodyweight * bwAdj * ageFactor);

  return logInterpolateBenchmarks(
    normalizedRatio,
    BASE_RATIOS[metric]
  );
}

/* ----------------------------
   Isolation lift percentile (1RM)
----------------------------- */
function isolationLiftPercentile(metric, oneRM, age, bodyweight) {
  const ageFactor = getAgeFactor(age);
  const bwAdj = Math.sqrt(bodyweight / 135);

  const normalized =
    oneRM / (bwAdj * ageFactor);

  return calculatePercentileFromBenchmarks(
    normalized,
    ISOLATION_BASE[metric]
  );
}

/* ============================
   EXPORTS
============================ */

/* ---- Compound lifts ---- */
[
  "bench_press",
  "squat",
  "deadlift",
  "shoulder_press",
  "lat_pulldown",
  "seated_row_close",
  "seated_row_wide",
].forEach((lift) => {
  percentileFunctions[`${lift}_percentile`] = (
    oneRM,
    age,
    bodyweight
  ) => compoundLiftPercentile(lift, oneRM, age, bodyweight);
});

/* ---- Isolation lifts ---- */
[
  "lateral_raise",
  "bicep_curl",
  "tricep_extension",
  "leg_extension",
  "leg_curl",
].forEach((lift) => {
  percentileFunctions[`${lift}_percentile`] = (
    oneRM,
    age,
    bodyweight
  ) => isolationLiftPercentile(lift, oneRM, age, bodyweight);
});

/* ----------------------------
   5K run (unchanged conceptually)
----------------------------- */
percentileFunctions.run_5k_percentile = (minutes, age, gender) => {
  const ageFactor = getAgeFactor(age);

  const benchmarks =
    gender === "male"
      ? [40, 30, 25, 22, 20, 18, 16]
      : [45, 35, 30, 27, 24, 21, 19];

  const adjusted = benchmarks.map((b) => b / ageFactor);
  const pct = 100 - calculatePercentileFromBenchmarks(minutes, adjusted);

  return Math.max(0, Math.min(100, pct));
};
