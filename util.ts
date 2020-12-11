import { Group } from "./group";
import { geometryFromSVGString, ImportSVGOptions } from "./svg";
import { Vec } from "./vec";

export const GeometryUtil = {
  normalize(a: unknown) {
    if (!a) return new Group();
    if (Array.isArray(a)) return new Group(a.flat(Infinity));
    return a;
  },
  fromSVGString(svgString: string, options: ImportSVGOptions) {
    return geometryFromSVGString(svgString, options);
  },
};

export interface ClosestPointResult {
  distance: number;
  position?: Vec;
  time?: number;
}

export interface ExportOptions {
  hairlineStrokeWidth?: number;
  maxPrecision?: number;
  useSVGPathClipping?: boolean;
}

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
