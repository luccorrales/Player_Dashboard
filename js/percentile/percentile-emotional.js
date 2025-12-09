// Emotional category percentile functions

// Emotional Intelligence (EQ) Score
percentileFunctions.emotional_intelligence_percentile = (eqScore) => {
  // EQ typically measured on scale similar to IQ (mean=100, sd=15)
  const mean = 100;
  const sd = 15;
  const z = (eqScore - mean) / sd;
  return Math.round(cumulativeNormalDistribution(z) * 100);
};

// Stress Management Score (0-100, higher is better)
percentileFunctions.stress_management_percentile = (score) => {
  // Most people score 40-60, good stress managers score 70+
  const benchmarks = [0, 30, 45, 55, 65, 75, 85, 95, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Resilience Score (Connor-Davidson Resilience Scale approximation)
percentileFunctions.resilience_percentile = (score) => {
  // CD-RISC scale 0-100, average is around 65-75
  const benchmarks = [0, 40, 55, 65, 75, 85, 92, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Meditation/Mindfulness Practice (minutes per day)
percentileFunctions.meditation_percentile = (minutesPerDay) => {
  // Most people don't meditate, 10-20 min/day is good, 30+ is excellent
  const benchmarks = [0, 5, 10, 15, 20, 30, 45, 60];
  return calculatePercentileFromBenchmarks(minutesPerDay, benchmarks);
};

// Sleep Quality Score (0-100)
percentileFunctions.sleep_quality_percentile = (score) => {
  // Average sleep quality is 60-70
  const benchmarks = [0, 40, 55, 65, 75, 85, 92, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Average Sleep Hours Per Night
percentileFunctions.sleep_hours_percentile = (hours) => {
  // Optimal is 7-9 hours, distribution is inverse-U shaped
  // We'll treat 7.5 as optimal and decline on both sides
  if (hours >= 7 && hours <= 9) {
    return 90 + Math.round((9 - Math.abs(hours - 8)) * 2);
  }
  const benchmarks = [3, 5, 6, 7, 8, 9, 10, 11];
  const percentile = calculatePercentileFromBenchmarks(hours, benchmarks);
  // Adjust to make 7-9 peak
  return hours < 7 || hours > 9 ? Math.round(percentile * 0.8) : percentile;
};

// Anxiety Level (GAD-7 score, lower is better)
percentileFunctions.anxiety_percentile = (gad7Score) => {
  // GAD-7: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe
  // Lower scores are better, so invert
  const benchmarks = [21, 15, 10, 7, 5, 3, 1, 0];
  const percentile = 100 - calculatePercentileFromBenchmarks(gad7Score, benchmarks);
  return Math.max(0, Math.min(100, percentile));
};

// Depression Level (PHQ-9 score, lower is better)
percentileFunctions.depression_percentile = (phq9Score) => {
  // PHQ-9: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe
  // Lower scores are better, so invert
  const benchmarks = [27, 20, 15, 10, 7, 5, 3, 0];
  const percentile = 100 - calculatePercentileFromBenchmarks(phq9Score, benchmarks);
  return Math.max(0, Math.min(100, percentile));
};

// Life Satisfaction Score (0-10 scale)
percentileFunctions.life_satisfaction_percentile = (score) => {
  // Average is around 6-7, convert to percentile
  const benchmarks = [0, 3, 5, 6, 7, 8, 9, 10];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Positive Affect Score (0-100)
percentileFunctions.positive_affect_percentile = (score) => {
  // PANAS positive affect scale
  const benchmarks = [0, 30, 45, 55, 65, 75, 85, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Gratitude Practice Score (entries per week in gratitude journal)
percentileFunctions.gratitude_percentile = (entriesPerWeek) => {
  // Most people don't journal, daily (7) is excellent
  const benchmarks = [0, 1, 2, 3, 5, 7, 10, 14];
  return calculatePercentileFromBenchmarks(entriesPerWeek, benchmarks);
};

// Self-Awareness Score (0-100 assessment-based)
percentileFunctions.self_awareness_percentile = (score) => {
  // Average person scores around 50
  const benchmarks = [0, 30, 45, 55, 65, 75, 85, 95, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Emotional Regulation Score (0-100)
percentileFunctions.emotional_regulation_percentile = (score) => {
  // DERS (Difficulties in Emotion Regulation Scale) inverted
  const benchmarks = [0, 35, 50, 60, 70, 80, 90, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Therapy/Counseling Sessions Attended (total lifetime)
percentileFunctions.therapy_sessions_percentile = (sessionCount) => {
  // Many people never attend therapy, regular attendance is healthy
  const benchmarks = [0, 1, 5, 10, 20, 50, 100, 200];
  return calculatePercentileFromBenchmarks(sessionCount, benchmarks);
};

// Burnout Score (Maslach Burnout Inventory, lower is better)
percentileFunctions.burnout_percentile = (mbiScore) => {
  // MBI 0-100, lower is better
  const benchmarks = [100, 80, 65, 50, 40, 30, 20, 10, 0];
  const percentile = 100 - calculatePercentileFromBenchmarks(mbiScore, benchmarks);
  return Math.max(0, Math.min(100, percentile));
};

// Work-Life Balance Score (0-100)
percentileFunctions.work_life_balance_percentile = (score) => {
  // Most people struggle with this (40-60 range)
  const benchmarks = [0, 30, 45, 55, 65, 75, 85, 95, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Social Support Score (0-100)
percentileFunctions.social_support_percentile = (score) => {
  // Perceived social support assessment
  const benchmarks = [0, 35, 50, 62, 72, 82, 92, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};

// Mindfulness Score (FFMQ - Five Facet Mindfulness Questionnaire)
percentileFunctions.mindfulness_percentile = (ffmqScore) => {
  // FFMQ 39-195, average around 120
  const benchmarks = [39, 80, 100, 120, 140, 160, 180, 195];
  return calculatePercentileFromBenchmarks(ffmqScore, benchmarks);
};

// Emotional Vocabulary Size (number of emotion words known)
percentileFunctions.emotional_vocabulary_percentile = (wordCount) => {
  // Most people know 20-30 emotion words, high EQ individuals know 50+
  const benchmarks = [10, 20, 30, 40, 50, 70, 100, 150];
  return calculatePercentileFromBenchmarks(wordCount, benchmarks);
};

// Optimism Score (0-100)
percentileFunctions.optimism_percentile = (score) => {
  // Life Orientation Test Revised (LOT-R)
  const benchmarks = [0, 30, 45, 55, 65, 75, 85, 95, 100];
  return calculatePercentileFromBenchmarks(score, benchmarks);
};
