// Main percentile registry loader (ES module)
// Re-exports the registry and loads all category modules for side-effect registration.

export { percentileFunctions } from './registry.js';

// Side-effect imports register functions onto percentileFunctions
import './percentile-physical.js';
import './percentile-cognitive.js';
import './percentile-financial.js';
import './percentile-social.js';
import './percentile-emotional.js';
