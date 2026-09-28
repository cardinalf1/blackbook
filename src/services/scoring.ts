import { IRTItemScore, ModuleRoute } from '../types/sat';

/**
 * 2-Parameter Logistic (2PL) Item Response Theory (IRT) model
 * with Bayesian Expected A Posteriori (EAP) ability estimation
 */

/**
 * 2PL Probability function P_i(\theta)
 * a: discrimination parameter
 * b: difficulty parameter
 * theta: latent ability trait
 */
export function irt2plProbability(theta: number, a: number, b: number): number {
  // Scaling constant D = 1.7 aligns the logistic metric with the normal ogive metric
  const z = 1.7 * a * (theta - b);
  // Guard against numerical overflow
  if (z > 35) return 1.0;
  if (z < -35) return 0.0;
  return 1.0 / (1.0 + Math.exp(-z));
}

/**
 * Standard normal prior density \phi(\theta)
 */
function standardNormalDensity(theta: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * theta * theta);
}

/**
 * Computes latent ability \hat{\theta} \in [-3.0, 3.0] using Bayesian Expected A Posteriori (EAP)
 * with quadrature integration over 61 equidistant grid points.
 */
export function estimateLatentAbilityEAP(items: IRTItemScore[]): number {
  if (items.length === 0) return 0.0;

  const QUAD_COUNT = 61;
  const MIN_THETA = -3.0;
  const MAX_THETA = 3.0;
  const STEP = (MAX_THETA - MIN_THETA) / (QUAD_COUNT - 1);

  const thetas: number[] = [];
  for (let i = 0; i < QUAD_COUNT; i++) {
    thetas.push(MIN_THETA + i * STEP);
  }

  // Compute log-likelihood at each quadrature point to prevent floating point underflow
  const logLikelihoods: number[] = thetas.map((theta) => {
    let logLik = 0;
    for (const item of items) {
      const p = irt2plProbability(theta, item.irt_a, item.irt_b);
      // Small epsilon to prevent log(0)
      const clampedP = Math.max(1e-7, Math.min(1 - 1e-7, p));
      if (item.correct) {
        logLik += Math.log(clampedP);
      } else {
        logLik += Math.log(1 - clampedP);
      }
    }
    // Add log of standard normal prior
    logLik += Math.log(standardNormalDensity(theta));
    return logLik;
  });

  // Softmax normalization for numerical stability
  const maxLogLik = Math.max(...logLikelihoods);
  const posteriors = logLikelihoods.map((ll) => Math.exp(ll - maxLogLik));
  const sumPosteriors = posteriors.reduce((acc, val) => acc + val, 0);

  if (sumPosteriors === 0 || isNaN(sumPosteriors)) {
    return 0.0;
  }

  // Expected value of theta under posterior distribution
  let expectedTheta = 0;
  for (let i = 0; i < QUAD_COUNT; i++) {
    expectedTheta += thetas[i] * (posteriors[i] / sumPosteriors);
  }

  // Clamp within [-3.0, 3.0]
  return Math.max(-3.0, Math.min(3.0, expectedTheta));
}

/**
 * Rounds a score to the nearest 10 points
 */
export function roundToNearestTen(score: number): number {
  return Math.round(score / 10) * 10;
}

/**
 * Converts latent ability \hat{\theta} to the College Board 200–800 scale
 * enforcing the official ~590 Easy Module 2 score ceiling.
 */
export function scaleAbilityToSectionScore(theta: number, module2Route: ModuleRoute): number {
  let rawScale: number;

  if (module2Route === 'Easy') {
    // Official ceiling formula: min(590, round(200 + 390 / (1 + exp(-1.10 * (theta - 0.20)))))
    const logistic = 390 / (1 + Math.exp(-1.10 * (theta - 0.20)));
    const unrounded = 200 + logistic;
    rawScale = Math.min(590, unrounded);
  } else {
    // Hard Module 2 formula: round(200 + 600 / (1 + exp(-0.85 * (theta + 0.15))))
    const logistic = 600 / (1 + Math.exp(-0.85 * (theta + 0.15)));
    rawScale = 200 + logistic;
  }

  const rounded = roundToNearestTen(rawScale);
  return Math.max(200, Math.min(800, rounded));
}

/**
 * Calculates national user percentile based on Digital SAT concordances
 */
export function calculateSATPercentile(compositeScore: number): number {
  if (compositeScore >= 1550) return 99;
  if (compositeScore >= 1500) return 98;
  if (compositeScore >= 1450) return 96;
  if (compositeScore >= 1400) return 93;
  if (compositeScore >= 1350) return 90;
  if (compositeScore >= 1300) return 86;
  if (compositeScore >= 1250) return 81;
  if (compositeScore >= 1200) return 74;
  if (compositeScore >= 1150) return 67;
  if (compositeScore >= 1100) return 59;
  if (compositeScore >= 1050) return 51;
  if (compositeScore >= 1000) return 43;
  if (compositeScore >= 950) return 35;
  if (compositeScore >= 900) return 27;
  if (compositeScore >= 800) return 15;
  return 5;
}
