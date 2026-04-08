'use strict';

const stateManager = require('./stateManager');
const { clamp, roundTo, averageSystemHealth } = require('../utils/scoreUtils');
const scoringMeta = require('../data/metadata/scoring.json');

/**
 * Strict clamp for benchmark validators:
 * score must be strictly inside (0, 1), never exactly 0 or 1.
 */
function strictClamp01(value) {
  const EPS = 0.0001;
  if (!Number.isFinite(value)) return 0.5;
  if (value <= 0) return EPS;
  if (value >= 1) return 1 - EPS;
  return value;
}

/**
 * Compute the final deterministic grade for a completed episode.
 * Returns a score strictly in (0.0, 1.0).
 *
 * Grading dimensions (weights come from scoring.json):
 *   1. System stability        (30%) — final avg health vs. target
 *   2. Customer harm reduction (25%) — how much impact was reduced
 *   3. Root cause resolution   (25%) — was root cause actually fixed
 *   4. Action efficiency       (10%) — steps used vs. max allowed
 *   5. Budget utilisation      (5%)  — budget remaining (not overspent)
 *   6. Harmful action avoidance (5%) — cascade traps, silenced real alerts
 *
 * @returns {{ score: number, breakdown: object, passed: boolean, success: boolean }}
 */
function computeFinalScore() {
  const state = stateManager.getState();

  // Safety fallback if state is not initialized
  if (!state || !state.services) {
    return {
      score: 0.0001,
      passed: false,
      success: false,
      error: 'State not initialised'
    };
  }

  const w = scoringMeta.weights;
  const thresholds = scoringMeta.thresholds;

  // -----------------------------
  // 1) SYSTEM STABILITY
  // -----------------------------
  const finalHealth = averageSystemHealth(state.services);
  let stabilityScore;

  if (finalHealth >= thresholds.full_score_system_health) {
    stabilityScore = 0.9999;
  } else if (finalHealth >= thresholds.pass_system_health) {
    // Linear interpolation between pass and full
    stabilityScore =
      (finalHealth - thresholds.pass_system_health) /
      (thresholds.full_score_system_health - thresholds.pass_system_health);
  } else {
    // Below pass threshold — linear down to partial credit
    stabilityScore = (finalHealth / thresholds.pass_system_health) * 0.5;
  }

  stabilityScore = strictClamp01(clamp(stabilityScore, 0, 1));

  // -----------------------------
  // 2) CUSTOMER HARM REDUCTION
  // -----------------------------
  const finalImpact = state.customer_impact;
  const initialImpact = state.initial_customer_impact || 70;

  let customerScore;

  if (finalImpact <= thresholds.full_score_customer_impact) {
    customerScore = 0.9999;
  } else if (finalImpact <= thresholds.pass_customer_impact) {
    customerScore =
      1.0 -
      ((finalImpact - thresholds.full_score_customer_impact) /
        (thresholds.pass_customer_impact - thresholds.full_score_customer_impact)) *
        0.5;
  } else {
    // Impact still high — partial credit for any reduction
    const reduction = clamp(initialImpact - finalImpact, 0, initialImpact);
    customerScore = (reduction / initialImpact) * 0.4;
  }

  customerScore = strictClamp01(clamp(customerScore, 0, 1));

  // -----------------------------
  // 3) ROOT CAUSE RESOLUTION
  // -----------------------------
  const rootCauseScore = state.root_cause_resolved ? 0.9999 : 0.0001;

  // -----------------------------
  // 4) ACTION EFFICIENCY
  // -----------------------------
  const stepsUsed = state.step_count || 0;
  const maxSteps = state.max_steps || 1;
  let efficiencyScore = 1.0 - (stepsUsed / maxSteps);
  efficiencyScore = strictClamp01(clamp(efficiencyScore, 0, 1));

  // -----------------------------
  // 5) BUDGET UTILISATION
  // -----------------------------
  const initialBudget = state.initial_budget || 1;
  const remainingBudget = state.remaining_budget || 0;
  const budgetRatio = remainingBudget / initialBudget;

  let budgetScore = budgetRatio * 1.5; // generously scaled
  budgetScore = strictClamp01(clamp(budgetScore, 0, 1));

  // -----------------------------
  // 6) HARMFUL ACTION AVOIDANCE
  // -----------------------------
  let harmScore = 0.9999;

  if (state.cascade_triggered) {
    harmScore += scoringMeta.penalties.cascade_triggered; // e.g. -0.15
  }

  const silencedRealAlerts = (state.active_alerts || []).filter(
    (a) => a.silenced && a.is_real
  ).length;

  harmScore -=
    silencedRealAlerts * Math.abs(scoringMeta.penalties.silent_real_alert || 0);

  if (state.reason === 'budget_exhausted') {
    harmScore += scoringMeta.penalties.budget_exhausted || 0;
  }

  if (state.reason === 'max_steps_reached') {
    harmScore += scoringMeta.penalties.max_steps_reached || 0;
  }

  harmScore = strictClamp01(clamp(harmScore, 0, 1));

  // -----------------------------
  // FINAL WEIGHTED SCORE
  // -----------------------------
  const raw =
    w.system_stability * stabilityScore +
    w.customer_harm_reduction * customerScore +
    w.root_cause_resolution * rootCauseScore +
    w.action_efficiency * efficiencyScore +
    w.budget_utilisation * budgetScore +
    w.harmful_action_avoidance * harmScore;

  const score = roundTo(strictClamp01(raw), 4);

  return {
    score,
    passed: score >= (thresholds.pass_score || 0.5),
    success: !!state.success,
    breakdown: {
      stabilityScore: roundTo(stabilityScore, 4),
      customerScore: roundTo(customerScore, 4),
      rootCauseScore: roundTo(rootCauseScore, 4),
      efficiencyScore: roundTo(efficiencyScore, 4),
      budgetScore: roundTo(budgetScore, 4),
      harmScore: roundTo(harmScore, 4),
      finalHealth: roundTo(finalHealth, 2),
      finalImpact,
      stepsUsed,
      maxSteps,
      remainingBudget,
      initialBudget
    }
  };
}

module.exports = { computeFinalScore };