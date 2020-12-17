import { Group } from "./group";
import { Vec } from "./vec";

export const normalizeGeometry = (a: unknown) => {
  if (!a) return new Group();
  if (Array.isArray(a)) return new Group(a.flat(Infinity));
  return a;
};

/**
 * ComponentWise generates a function that accepts either number and Vec
 * arguments.
 *
 * @returns A number if all arguments are numbers. If any argument is a Vec then
 * `fn` is applied component-wise to `x` and `y` and a Vec is returned.
 */
export const componentWise1 = (fn: (a: number) => number) => {
  return (v1: Vec | number) => {
    if (v1 instanceof Vec) {
      return new Vec(fn(v1.x), fn(v1.y));
    }
    return fn(v1);
  };
};
export const componentWise2 = (fn: (a: number, b: number) => number) => {
  return (v1: Vec | number, v2: Vec | number) => {
    const isVec1 = v1 instanceof Vec;
    const isVec2 = v2 instanceof Vec;

    if (!isVec1 && !isVec2) {
      return fn(v1 as number, v2 as number);
    }

    const v1x = isVec1 ? (v1 as Vec).x : (v1 as number);
    const v1y = isVec1 ? (v1 as Vec).y : (v1 as number);
    const v2x = isVec2 ? (v2 as Vec).x : (v2 as number);
    const v2y = isVec2 ? (v2 as Vec).y : (v2 as number);

    return new Vec(fn(v1x, v2x), fn(v1y, v2y));
  };
};
export const componentWise3 = (fn: (a: number, b: number, c: number) => number) => {
  return (v1: Vec | number, v2: Vec | number, v3: Vec | number) => {
    const isVec1 = v1 instanceof Vec;
    const isVec2 = v2 instanceof Vec;
    const isVec3 = v3 instanceof Vec;

    if (!isVec1 && !isVec2 && !isVec3) {
      return fn(v1 as number, v2 as number, v3 as number);
    }

    const v1x = isVec1 ? (v1 as Vec).x : (v1 as number);
    const v1y = isVec1 ? (v1 as Vec).y : (v1 as number);
    const v2x = isVec2 ? (v2 as Vec).x : (v2 as number);
    const v2y = isVec2 ? (v2 as Vec).y : (v2 as number);
    const v3x = isVec3 ? (v3 as Vec).x : (v3 as number);
    const v3y = isVec3 ? (v3 as Vec).y : (v3 as number);

    return new Vec(fn(v1x, v2x, v3x), fn(v1y, v2y, v3y));
  };
};

// Built-in Array Utility

export const range = (start: number, stop?: number, step = 1) => {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }

  // via https://github.com/d3/d3-array/blob/master/src/range.js
  const n = Math.max(0, Math.ceil((stop - start) / step)) | 0;
  const range: number[] = new Array(n);
  for (let i = 0; i < n; ++i) {
    range[i] = start + i * step;
  }

  return range;
};

export function pairs<T>(array: T[], loop = false): [T, T][] {
  const pairs: [T, T][] = [];
  if (array.length >= 2) {
    let prev = array[0];
    for (let i = 1, n = array.length; i < n; ++i) {
      const current = array[i];
      pairs.push([prev, current]);
      prev = current;
    }
    if (loop) {
      pairs.push([prev, array[0]]);
    }
  }
  return pairs;
}

export function rotateArray<T>(array: T[], zeroIndex: number) {
  array.push(...array.splice(0, zeroIndex));
}
