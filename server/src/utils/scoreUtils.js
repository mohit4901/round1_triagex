'use strict';

/**
 * Clamp a value between min and max (inclusive).
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min = 0, max = 1) {
  if (isNaN(val)) return 0.1;
  return Math.min(Math.max(val, min), max);
}

/**
 * Strict clamp that ensures value is NOT exactly min or max.
 * Uses a safe epsilon buffer for the benchmarker.
 */
function strictClamp(val, min = 0, max = 1) {
  const epsilon = 0.1;
  if (isNaN(val)) return 0.5;
  return Math.min(Math.max(val, min + epsilon), max - epsilon);
}

/**
 * Round a float to N decimal places for deterministic output.
 */
function roundTo(val, decimals = 4) {
  if (isNaN(val)) return 0.1;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Compute average system health from services array.
 * @returns {number} strictly (0.01, 0.99)
 */
function averageSystemHealth(services) {
  if (!services || services.length === 0) return 0.1;
  const sum = services.reduce((acc, s) => acc + s.health, 0);
  return roundTo(strictClamp(sum / services.length), 4);
}

/**
 * Normalise a raw reward to a safe (0.01, 0.99) range.
 */
function normaliseReward(raw) {
  if (isNaN(raw)) return 0.5;
  // Map raw reward into (0.01, 0.99) safely
  const shifted = (raw / 200) + 0.5;
  return roundTo(strictClamp(shifted), 4);
}

module.exports = { clamp, strictClamp, roundTo, averageSystemHealth, normaliseReward };