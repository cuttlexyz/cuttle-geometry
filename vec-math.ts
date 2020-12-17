import { DEGREES_PER_RADIAN, RADIANS_PER_DEGREE } from "./constants";
import { componentWise1, componentWise2, componentWise3 } from "./util";

export const sin = componentWise1((angle) => Math.sin(angle * RADIANS_PER_DEGREE));
export const cos = componentWise1((angle) => Math.cos(angle * RADIANS_PER_DEGREE));
export const tan = componentWise1((angle) => Math.tan(angle * RADIANS_PER_DEGREE));

export const asin = componentWise1((x) => Math.asin(x) * DEGREES_PER_RADIAN);
export const acos = componentWise1((x) => Math.acos(x) * DEGREES_PER_RADIAN);
export const atan = componentWise1((x) => Math.atan(x) * DEGREES_PER_RADIAN);
export const atan2 = (y: number, x: number) => Math.atan2(y, x) * DEGREES_PER_RADIAN;

export const sqrt = componentWise1(Math.sqrt);
export const cbrt = componentWise1(Math.cbrt);

export const abs = componentWise1(Math.abs);
export const sign = componentWise1(Math.sign);

export const log = componentWise1(Math.log);
export const log2 = componentWise1(Math.log2);
export const log10 = componentWise1(Math.log10);

export const floor = componentWise1(Math.floor);
export const ceil = componentWise1(Math.ceil);
export const round = componentWise1(Math.round);
export const trunc = componentWise1(Math.trunc);

export const max = componentWise2((a, b) => (a > b ? a : b));
export const min = componentWise2((a, b) => (a < b ? a : b));

export const mix = componentWise3((a, b, t) => a + (b - a) * t);

export const clamp = componentWise3((x, min, max) => {
  return x < min ? min : x > max ? max : x;
});

const saturate = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const smoothstep = componentWise3((edge0, edge1, x) => {
  x = saturate((x - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
});
