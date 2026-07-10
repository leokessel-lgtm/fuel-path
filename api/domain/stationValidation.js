function boundedNumberParam(value, name, fallback, { min, max, clampMax = true }) {
  const raw = Array.isArray(value) ? value[0] : value;
  if ((raw === undefined || raw === null || raw === "") && fallback !== undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  if (parsed < min) throw new Error(`${name} must be at least ${min}`);
  if (!clampMax && parsed > max) throw new Error(`${name} must be at most ${max}`);
  return Math.min(parsed, max);
}

function coordinateParam(value, name, min, max) {
  if (value === undefined || value === null || value === "") throw new Error(`${name} is required`);
  return boundedNumberParam(value, name, undefined, { min, max, clampMax: false });
}

module.exports = {
  boundedNumberParam,
  coordinateParam,
};
