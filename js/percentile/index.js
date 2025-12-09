// index.js
import { cognitivePercentiles } from "./percentile-cognitive.js";
import { emotionalPercentiles } from "./percentile-emotional.js";
import { financialPercentiles } from "./percentile-financial.js";
import { physicalPercentiles } from "./percentile-physical.js";
import { socialPercentiles } from "./percentile-social.js";

export const percentileFunctions = {
  ...cognitivePercentiles,
  ...emotionalPercentiles,
  ...financialPercentiles,
  ...physicalPercentiles,
  ...socialPercentiles,
};
