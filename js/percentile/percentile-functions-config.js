// Configuration for available percentile functions (ES module)
export const percentileFunctionsConfig = {
  functions: [
    { value: 'networth_percentile', label: 'Net Worth (age-adjusted)', category: 'financial' },
    { value: 'income_percentile', label: 'Income', category: 'financial' },
    
    { value: 'bench_press_percentile', label: 'Bench Press (weight/bodyweight)', category: 'physical' },
    { value: 'squat_percentile', label: 'Squat (weight/bodyweight)', category: 'physical' },
    { value: 'deadlift_percentile', label: 'Deadlift (weight/bodyweight)', category: 'physical' },
    { value: 'shoulder_press_percentile', label: 'Shoulder Press', category: 'physical' },
    { value: 'lat_pulldown_percentile', label: 'Lat Pulldown', category: 'physical' },
    { value: 'seated_row_close_percentile', label: 'Seated Row (Close)', category: 'physical' },
    { value: 'seated_row_wide_percentile', label: 'Seated Row (Wide)', category: 'physical' },
    
    { value: 'lateral_raise_percentile', label: 'Lateral Raise', category: 'physical' },
    { value: 'bicep_curl_percentile', label: 'Bicep Curl', category: 'physical' },
    { value: 'tricep_extension_percentile', label: 'Tricep Extension', category: 'physical' },
    { value: 'leg_extension_percentile', label: 'Leg Extension', category: 'physical' },
    { value: 'leg_curl_percentile', label: 'Leg Curl', category: 'physical' },

    { value: 'run_5k_percentile', label: '5K Run Time', category: 'physical' },
    { value: 'strength_ratio_percentile', label: 'Strength Ratio', category: 'physical' },
    
    { value: 'iq_percentile', label: 'IQ', category: 'cognitive' },
    { value: 'emotional_intelligence_percentile', label: 'Emotional Intelligence Score', category: 'emotional' }
  ],
  
  parameters: {
    networth_percentile: ["value", "age"],
    income_percentile: ["value"],
    
    bench_press_percentile: ["weight", "age", "bodyweight"],
    squat_percentile: ["weight", "age", "bodyweight"],
    deadlift_percentile: ["weight", "age", "bodyweight"],
    shoulder_press_percentile: ["weight", "age", "bodyweight"],
    lat_pulldown_percentile: ["weight", "age", "bodyweight"],
    seated_row_close_percentile: ["weight", "age", "bodyweight"],
    seated_row_wide_percentile: ["weight", "age", "bodyweight"],
  
    lateral_raise_percentile: ["weight", "age", "bodyweight"],
    bicep_curl_percentile: ["weight", "age", "bodyweight"],
    tricep_extension_percentile: ["weight", "age", "bodyweight"],
    leg_extension_percentile: ["weight", "age", "bodyweight"],
    leg_curl_percentile: ["weight", "age", "bodyweight"],

    run_5k_percentile: ["minutes", "age", "gender"],
    strength_ratio_percentile: ["weight", "bodyweight"],
    
    iq_percentile: ["value"],
    emotional_intelligence_percentile: ["eqScore"]
  }
};
