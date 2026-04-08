'use strict';

/**
 * Clamp a value between min and max (inclusive).
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min = 0, max = 1) {
  if (!Number.isFinite(val)) return 0.0001;
  return Math.min(Math.max(val, min), max);
}

/**
 * Strict clamp that ensures value is NEVER exactly min or max.
 * Safe for validators that require score strictly inside (0, 1).
 *
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function strictClamp(val, min = 0, max = 1) {
  const EPS = 0.0001;
  if (!Number.isFinite(val)) return 0.5;
  return Math.min(Math.max(val, min + EPS), max - EPS);
}

/**
 * Round a float to N decimal places for deterministic output.
 *
 * @param {number} val
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(val, decimals = 4) {
  if (!Number.isFinite(val)) return 0.0001;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Compute average system health from services array.
 * Always returns strictly inside (0, 1).
 *
 * @param {Array<{health:number}>} services
 * @returns {number}
 */
function averageSystemHealth(services) {
  if (!Array.isArray(services) || services.length === 0) return 0.0001;

  const validHealths = services
    .map(s => Number(s.health))
    .filter(h => Number.isFinite(h));

  if (validHealths.length === 0) return 0.0001;

  const sum = validHealths.reduce((acc, h) => acc + h, 0);
  const avg = sum / validHealths.length;

  return roundTo(strictClamp(avg, 0, 1), 4);
}

/**
 * Normalise a raw reward to a safe strict (0, 1) range.
 * Assumes raw reward is roughly in [-100, +100] or similar.
 *
 * @param {number} raw
 * @returns {number}
 */
function normaliseReward(raw) {
  if (!Number.isFinite(raw)) return 0.5;

  // Shift roughly into [0,1]
  const shifted = (raw / 200) + 0.5;

  return roundTo(strictClamp(shifted, 0, 1), 4);
}

module.exports = {
  clamp,
  strictClamp,
  roundTo,
  averageSystemHealth,
  normaliseReward
};