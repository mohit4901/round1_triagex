'use strict';

/**
 * Clamp a value between min and max (inclusive).
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Clamp a value strictly between min and max (exclusive).
 * Uses a tiny epsilon to avoid 0.0 and 1.0.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function strictClamp(val, min = 0, max = 1) {
  const epsilon = 0.001;
  return Math.min(Math.max(val, min + epsilon), max - epsilon);
}

/**
 * Round a float to N decimal places for deterministic output.
 * @param {number} val
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(val, decimals = 4) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Compute average system health from services array.
 * @param {Array} services
 * @returns {number} 0–1
 */
function averageSystemHealth(services) {
  if (!services || services.length === 0) return 0.001;
  const sum = services.reduce((acc, s) => acc + s.health, 0);
  return roundTo(strictClamp(sum / services.length), 4);
}

/**
 * Normalise a raw reward to a safe range.
 * @param {number} raw
 * @returns {number}
 */
function normaliseReward(raw) {
  // Map -100 to 100 range into a very small but non-zero positive range if needed, 
  // but wait, if the portal expects (0, 1), maybe it expects rewards to be in that range too?
  // Let's assume rewards should be in (0, 1) if they are parsed as scores.
  return roundTo(strictClamp(raw / 100 + 0.5), 4);
}

module.exports = { clamp, strictClamp, roundTo, averageSystemHealth, normaliseReward };