import {
  DEFAULT_EPSILON,
  DEFAULT_PRECISION,
  DEFAULT_TOLERANCE,
  DEGREES_PER_RADIAN,
  RADIANS_PER_DEGREE,
} from "./constants";

/**
 * Returns the sine of a number.
 * @param angle A numeric expression that contains an angle measured in degrees.
 */
export const sin = (angle: number) => Math.sin(angle * RADIANS_PER_DEGREE);
export const cos = (angle: number) => Math.cos(angle * RADIANS_PER_DEGREE);
export const tan = (angle: number) => Math.tan(angle * RADIANS_PER_DEGREE);

export const asin = (x: number) => Math.asin(x) * DEGREES_PER_RADIAN;
export const acos = (x: number) => Math.acos(x) * DEGREES_PER_RADIAN;
export const atan = (x: number) => Math.atan(x) * DEGREES_PER_RADIAN;
export const atan2 = (y: number, x: number) => Math.atan2(y, x) * DEGREES_PER_RADIAN;

export const sqrt = Math.sqrt;
export const abs = Math.abs;

export const max = Math.max;
export const min = Math.min;

// TODO: Make these work for Vecs.
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (x: number, min: number, max: number) => {
  return x < min ? min : x > max ? max : x;
};
export const saturate = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  x = saturate((x - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

/**
 * This is like `x % base` except if `x` is negative it will return a positive
 * result. For example `modulo(-2, 5) === 3`.
 */
export const modulo = (x: number, base: number) => {
  const result = x % base;
  return result < 0 ? result + base : result;
};

/**
 * Returns the (smallest) absolute difference between `a` and `b` in modulo
 * `base` space. The result will be constrained to `0 <= difference <= base /
 * 2`. This is used, for example, in `angularDistance` to wrap around `360`.
 */
export const moduloDistance = (a: number, b: number, base: number) => {
  const diff = Math.abs(b - a) % base;
  return diff > base / 2 ? base - diff : diff;
};

/**
 * Given two angles in degrees, returns the smallest absolute difference between
 * the angles. It will be in the range `0` to `180`.
 */
export const angularDistance = (a: number, b: number) => {
  return moduloDistance(a, b, 360);
};

// Equivalent of number.toFixed() that outputs a number instead of a string
export const roundToFixed = (x: number, fractionDigits: number) => {
  const scale = Math.pow(10, fractionDigits);
  return Math.round(x * scale) / scale;
};

// Comparisons using this function may need to be more rigorous. We need to look
// at each use case and decide what specific level of precision is required.
// Good reference here:
// https://randomascii.wordpress.com/2012/02/25/comparing-floating-point-numbers-2012-edition/
export const equalWithinRelativeEpsilon = (a: number, b: number, epsilon = DEFAULT_EPSILON) => {
  const d = Math.abs(b - a);
  a = Math.abs(a);
  b = Math.abs(b);
  return d <= Math.max(a, b) * epsilon;
};

export const equalWithinTolerance = (a: number, b: number, tolerance = DEFAULT_TOLERANCE) => {
  return Math.abs(a - b) <= tolerance;
};

export const limitedPrecisionStringForNumber = (
  x: number,
  minFractionDigits: number,
  maxFractionDigits: number
) => {
  const str = x.toFixed(maxFractionDigits);
  let len = str.length;
  let i = len;
  if (maxFractionDigits > 0) {
    for (let j = maxFractionDigits + 1; --j >= minFractionDigits && --i >= 0 && str[i] === "0"; );
    if (str[i] !== ".") i++;
  }
  return str.slice(0, i);
};

export const expressionCodeForNumber = (
  x: number,
  minFractionDigits = 0,
  maxFractionDigits = DEFAULT_PRECISION
) => {
  return limitedPrecisionStringForNumber(x, minFractionDigits, maxFractionDigits);
};

// TODO (toby): Add other Math functions
// TODO (toby): Make all these (especially floor and ceil) work componentwise on vectors
