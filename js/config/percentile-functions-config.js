// Configuration for available percentile functions
const percentileFunctionsConfig = {
  functions: [
    { value: 'networth_percentile', label: 'Net Worth (age-adjusted)', category: 'financial' },
    { value: 'income_percentile', label: 'Income', category: 'financial' },
    { value: 'bench_press_percentile', label: 'Bench Press (weight/bodyweight)', category: 'physical' },
    { value: 'squat_percentile', label: 'Squat (weight/bodyweight)', category: 'physical' },
    { value: 'deadlift_percentile', label: 'Deadlift (weight/bodyweight)', category: 'physical' },
    { value: 'iq_percentile', label: 'IQ', category: 'cognitive' },
    { value: 'run_5k_percentile', label: '5K Run Time', category: 'physical' },
    { value: 'strength_ratio_percentile', label: 'Strength Ratio', category: 'physical' }
  ],
  
  parameters: {
    networth_percentile: ["value", "age"],
    income_percentile: ["value"],
    bench_press_percentile: ["weight", "age", "bodyweight"],
    iq_percentile: ["value"],
    run_5k_percentile: ["minutes", "age", "gender"],
    strength_ratio_percentile: ["weight", "bodyweight"]
  }
};
