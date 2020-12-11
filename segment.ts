import { Bezier } from "../deps";
import { Anchor } from "./anchor";
import { bernsteinBezierFormForClosestPointOnCubic, findRoots } from "./bezier";
import { BoundingBox } from "./bounding-box";
import { DEFAULT_TOLERANCE } from "./constants";
import { saturate } from "./math";
import { Path } from "./path";
import { pairs } from "./util";
import { Vec } from "./vec";

//
// Segment
//

export type Segment = [Anchor, Anchor];

export const isSegmentLinear = ([anchor1, anchor2]: Segment) => {
  return anchor1.handleOut.isZero() && anchor2.handleIn.isZero();
};

export const linearSegmentLength = (segment: Segment) => {
  return segment[0].position.distance(segment[1].position);
};

export const segmentLength = (segment: Segment) => {
  if (isSegmentLinear(segment)) {
    return linearSegmentLength(segment);
  }
  return bezierFromSegment(segment).length();
};

export const partialSegmentLength = (segment: Segment, endTime: number) => {
  if (isSegmentLinear(segment)) {
    return endTime * segment[0].position.distance(segment[1].position);
  }
  return partialLengthOfBezier(bezierFromSegment(segment), endTime);
};

//
// Line
//

export type Line = [Vec, Vec];

export const lineFromSegment = ([a1, a2]: Segment): Line => {
  return [a1.position, a2.position];
};

export const positionAndTimeAtClosestPointOnLine = (point: Vec, [p1, p2]: Line) => {
  const lineDir = p2.clone().sub(p1);
  const pointDir = point.clone().sub(p1);
  const time = saturate(pointDir.dot(lineDir) / lineDir.lengthSquared());
  const position = lineDir.mulScalar(time).add(p1);
  return { position, time };
};

//
// Cubic
//

export type Cubic = [Vec, Vec, Vec, Vec];

export const cubicFromSegment = ([anchor1, anchor2]: Segment): Cubic => {
  return [
    anchor1.position,
    anchor1.position.clone().add(anchor1.handleOut),
    anchor2.position.clone().add(anchor2.handleIn),
    anchor2.position,
  ];
};

export const pointOnCubicAtTime = (out: Vec, [p0, p1, p2, p3]: Cubic, time: number) => {
  if (time === 0) return out.copy(p0);
  if (time === 1) return out.copy(p3);

  const oneMinusTime = 1 - time;
  const timeSq = time * time;
  const oneMinusTimeSq = oneMinusTime * oneMinusTime;

  const a = oneMinusTimeSq * oneMinusTime;
  const b = oneMinusTimeSq * time * 3;
  const c = oneMinusTime * timeSq * 3;
  const d = time * timeSq;

  return out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y
  );
};

export const positionAndTimeAtClosestPointOnCubic = (point: Vec, cubic: Cubic) => {
  const w = bernsteinBezierFormForClosestPointOnCubic(point, cubic);
  const roots = findRoots(w, 5);

  let closestDistanceSq = point.distanceSquared(cubic[0]);
  let position = cubic[0].clone();
  let time = 0;

  const scratchPoint = new Vec();
  for (let t of roots) {
    pointOnCubicAtTime(scratchPoint, cubic, t);
    const distanceSq = point.distanceSquared(scratchPoint);
    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      position.copy(scratchPoint);
      time = t;
    }
  }
  if (point.distanceSquared(cubic[3]) < closestDistanceSq) {
    position.copy(cubic[3]);
    time = 1;
  }

  return { position, time };
};

export const cubicsBySplittingCubicAtTime = (
  [p0, p1, p2, p3]: Cubic,
  t: number
): [Cubic, Cubic] => {
  const m = Vec.mix(p1, p2, t);
  const a0 = p0;
  const a1 = Vec.mix(p0, p1, t);
  const a2 = Vec.mix(a1, m, t);
  const b3 = p3;
  const b2 = Vec.mix(p2, p3, t);
  const b1 = Vec.mix(m, b2, t);
  const a3 = Vec.mix(a2, b1, t);
  const b0 = a3;
  return [
    [a0, a1, a2, a3],
    [b0, b1, b2, b3],
  ];
};

export const cubicByTrimmingCubic = (cubic: Cubic, start: number, end: number): Cubic => {
  if (start > end) {
    [start, end] = [end, start];
    cubic = [cubic[3], cubic[2], cubic[1], cubic[0]];
  }
  if (start !== 0) cubic = cubicsBySplittingCubicAtTime(cubic, start)[1];
  if (end !== 1) cubic = cubicsBySplittingCubicAtTime(cubic, (end - start) / (1 - start))[0];
  return cubic;
};

//
// Intersections
//

export interface PrimitiveIntersectionResult {
  time1: number;
  time2: number;
}
export interface IntersectionResult {
  path1: Path;
  path2: Path;
  time1: number;
  time2: number;
  position: Vec;
  distance?: number;
}

export const lineLineIntersections = (
  [p1, p2]: Line,
  [p3, p4]: Line
): PrimitiveIntersectionResult[] => {
  // http://www-cs.ccny.cuny.edu/~wolberg/capstone/intersection/Intersection%20point%20of%20two%20lines.html
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  // If denom === 0, lines are parallel.
  if (denom === 0) return [];
  // TODO: Need to watch out for intersections at or near the endpoints.
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  if (ua < 0 || ua > 1) return [];
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
  if (ub < 0 || ub > 1) return [];
  return [{ time1: ua, time2: ub }];
};

export const lineCubicIntersections = (
  [a1, a2]: Line,
  [b1, b2, b3, b4]: Cubic
): PrimitiveIntersectionResult[] => {
  const bezier = new Bezier(b1, b2, b3, b4);
  const line = { p1: a1, p2: a2 };
  const time2s = bezier.lineIntersects(line);
  return time2s.map((time2) => {
    const point = vecFromBezierPoint(bezier.compute(time2));
    const segmentDir = a2.clone().sub(a1);
    const pointDir = point.clone().sub(a1);
    const time1 = pointDir.dot(segmentDir) / segmentDir.lengthSquared();
    return { time1, time2 };
  });

  // This sometimes has precision issues at end points. Also time1, as computed,
  // will be slightly less than 0 sometimes.

  // TODO: Replace this bezier.js implementation with our own. Notes below:

  // https://pomax.github.io/bezierinfo/#intersections

  // Check that the line isn't trivial (a1 !== a2)

  // Transform the Cubic so that it's in the reference frame of the line, with
  // the line being horizontal.

  // Solve the cubic for y = 0.
  // https://stackoverflow.com/questions/27176423/function-to-solve-cubic-equation-analytically
  // https://gist.github.com/weepy/6009631
  // https://github.com/tab58/minimatrix-polyroots
  // http://people.eecs.berkeley.edu/~wkahan/Math128/Cubic.pdf

  // Now that we have t values that make y=0, check that these give x values on
  // the (transformed) line.

  return [];
};
export const cubicLineIntersections = (cubic: Cubic, line: Line): PrimitiveIntersectionResult[] => {
  return lineCubicIntersections(line, cubic).map(({ time1, time2 }) => ({
    time1: time2,
    time2: time1,
  }));
};

interface Candidate {
  time1: number;
  cubic1: Cubic;
  time2: number;
  cubic2: Cubic;
}
const cubicBoundingBoxesOverlap = ([a1, a2, a3, a4]: Cubic, [b1, b2, b3, b4]: Cubic) => {
  const axMin = Math.min(a1.x, a2.x, a3.x, a4.x);
  const axMax = Math.max(a1.x, a2.x, a3.x, a4.x);
  const ayMin = Math.min(a1.y, a2.y, a3.y, a4.y);
  const ayMax = Math.max(a1.y, a2.y, a3.y, a4.y);
  const bxMin = Math.min(b1.x, b2.x, b3.x, b4.x);
  const bxMax = Math.max(b1.x, b2.x, b3.x, b4.x);
  const byMin = Math.min(b1.y, b2.y, b3.y, b4.y);
  const byMax = Math.max(b1.y, b2.y, b3.y, b4.y);
  if (axMax < bxMin || axMin > bxMax || ayMax < byMin || ayMin > byMax) return false;
  return true;
};
const cubicLinesIntersect = ([a1, a2, a3, a4]: Cubic, [b1, b2, b3, b4]: Cubic) => {
  return lineLineIntersections([a1, a4], [b1, b4]).length > 0;
};
const cubicsEqual = ([a1, a2, a3, a4]: Cubic, [b1, b2, b3, b4]: Cubic) => {
  return (
    (a1.equals(b1) && a2.equals(b2) && a3.equals(b3) && a4.equals(b4)) ||
    (a1.equals(b4) && a2.equals(b3) && a3.equals(b2) && a4.equals(b1))
  );
};
const cubicsAlmostEqual = ([a1, a2, a3, a4]: Cubic, [b1, b2, b3, b4]: Cubic, tolerance: number) => {
  return (
    (a1.distance(b1) <= tolerance &&
      a2.distance(b2) <= tolerance &&
      a3.distance(b3) <= tolerance &&
      a4.distance(b4) <= tolerance) ||
    (a1.distance(b4) <= tolerance &&
      a2.distance(b3) <= tolerance &&
      a3.distance(b2) <= tolerance &&
      a4.distance(b1) <= tolerance)
  );
};
const cubicsOverlap = (cubic1: Cubic, cubic2: Cubic, tolerance: number) => {
  // We first try to find if any of the endpoints are near the other cubic, and
  // store the corresponding times.
  const matches: { time1: number; time2: number }[] = [];
  const box1 = BoundingBox.fromPoints(cubic1)!.expandScalar(tolerance);
  const box2 = BoundingBox.fromPoints(cubic2)!.expandScalar(tolerance);
  {
    const point = cubic1[0];
    if (box2.containsPoint(point)) {
      let { position, time } = positionAndTimeAtClosestPointOnCubic(point, cubic2);
      if (position.distance(point) < tolerance) matches.push({ time1: 0, time2: time });
    }
  }
  {
    const point = cubic1[3];
    if (box2.containsPoint(point)) {
      let { position, time } = positionAndTimeAtClosestPointOnCubic(point, cubic2);
      if (position.distance(point) < tolerance) matches.push({ time1: 1, time2: time });
    }
  }
  {
    const point = cubic2[0];
    if (box1.containsPoint(point)) {
      let { position, time } = positionAndTimeAtClosestPointOnCubic(point, cubic1);
      if (position.distance(point) < tolerance) matches.push({ time1: time, time2: 0 });
    }
  }
  {
    const point = cubic2[3];
    if (box1.containsPoint(point)) {
      let { position, time } = positionAndTimeAtClosestPointOnCubic(point, cubic1);
      if (position.distance(point) < tolerance) matches.push({ time1: time, time2: 1 });
    }
  }
  if (matches.length < 2) return false;
  matches.sort((a, b) => a.time1 - b.time1);
  const start1 = matches[0].time1;
  const end1 = matches[matches.length - 1].time1;
  // This is a dubious place to use tolerance since it's measuring in time, not
  // space.
  if (end1 - start1 < tolerance) return false;
  let start2 = matches[0].time2;
  let end2 = matches[matches.length - 1].time2;
  // If they truly overlap, the cubics start1-end1 and start2-end2 should be the
  // same. Trim cubic1 and cubic2 so that they range from start1-end1 and
  // start2-end.
  cubic1 = cubicByTrimmingCubic(cubic1, start1, end1);
  cubic2 = cubicByTrimmingCubic(cubic2, start2, end2);
  return cubic1[1].distance(cubic2[1]) < tolerance && cubic1[2].distance(cubic2[2]) < tolerance;
};
export const cubicCubicIntersections = (
  cubic1: Cubic,
  cubic2: Cubic
): PrimitiveIntersectionResult[] => {
  // Optimization: try to exit early, especially if the cubics have overlap
  // which will make this algorithm blow up.
  const tolerance = DEFAULT_TOLERANCE;
  if (cubicsEqual(cubic1, cubic2) || cubicsAlmostEqual(cubic1, cubic2, tolerance)) return [];
  if (!cubicBoundingBoxesOverlap(cubic1, cubic2)) return [];
  if (cubicsOverlap(cubic1, cubic2, tolerance)) return [];

  let candidates: Candidate[] = [{ time1: 0, cubic1, time2: 0, cubic2 }];
  let timeLength = 1;

  const boundingBoxIterations = 10;
  const maxIterations = 20;
  for (let i = 0; i < maxIterations; i++) {
    const nextCandidates: Candidate[] = [];
    const nextTimeLength = timeLength * 0.5;
    for (const { time1, cubic1, time2, cubic2 } of candidates) {
      const keepExploring =
        i < boundingBoxIterations
          ? cubicBoundingBoxesOverlap(cubic1, cubic2)
          : cubicLinesIntersect(cubic1, cubic2);
      if (keepExploring) {
        const [cubic1a, cubic1b] = cubicsBySplittingCubicAtTime(cubic1, 0.5);
        const [cubic2a, cubic2b] = cubicsBySplittingCubicAtTime(cubic2, 0.5);
        nextCandidates.push(
          { time1: time1, cubic1: cubic1a, time2: time2, cubic2: cubic2a },
          { time1: time1, cubic1: cubic1a, time2: time2 + nextTimeLength, cubic2: cubic2b },
          { time1: time1 + nextTimeLength, cubic1: cubic1b, time2: time2, cubic2: cubic2a },
          {
            time1: time1 + nextTimeLength,
            cubic1: cubic1b,
            time2: time2 + nextTimeLength,
            cubic2: cubic2b,
          }
        );
      }
    }
    if (nextCandidates.length === 0) return [];
    candidates = nextCandidates;
    timeLength = nextTimeLength;
  }

  const intersections: PrimitiveIntersectionResult[] = [];
  candidates.forEach(({ time1, cubic1, time2, cubic2 }) => {
    const llIntersections = lineLineIntersections([cubic1[0], cubic1[3]], [cubic2[0], cubic2[3]]);
    for (let llIntersection of llIntersections) {
      intersections.push({
        time1: time1 + llIntersection.time1 * timeLength,
        time2: time2 + llIntersection.time2 * timeLength,
      });
    }
  });
  return intersections;
};

export const cubicSelfIntersections = ([a1, a2, a3, a4]: Cubic): PrimitiveIntersectionResult[] => {
  // TODO!
  return [];
};

const primitivePrimitiveIntersections = (p1: Line | Cubic, p2: Line | Cubic) => {
  if (p1.length === 2) {
    // p1 Line
    if (p2.length === 2) return lineLineIntersections(p1, p2);
    else return lineCubicIntersections(p1, p2);
  } else {
    // p1 Cubic
    if (p2.length === 2) return cubicLineIntersections(p1, p2);
    else return cubicCubicIntersections(p1, p2);
  }
};

interface TaggedPrimitive {
  primitive: Cubic | Line;
  path: Path;
  index: number;
}
const taggedPrimitivesFromPaths = (paths: Path[], maxDistance?: number, point?: Vec) => {
  const taggedPrimitives: TaggedPrimitive[] = [];
  for (let path of paths) {
    const segments = pairs(path.anchors, path.closed);
    for (let i = 0, n = segments.length; i < n; ++i) {
      const segment = segments[i];
      const primitive = isSegmentLinear(segment)
        ? lineFromSegment(segment)
        : cubicFromSegment(segment);
      if (maxDistance === undefined || point === undefined) {
        taggedPrimitives.push({ primitive, path, index: i });
      } else {
        // TODO: make a more efficient function than BoundingBox.fromPoints
        const bounds = BoundingBox.fromPoints(primitive)!.expandScalar(maxDistance);
        if (bounds.containsPoint(point)) {
          taggedPrimitives.push({ primitive, path, index: i });
        }
      }
    }
  }
  return taggedPrimitives;
};
const accumulateIntersectionResults = (
  intersectionResults: IntersectionResult[],
  tp1: TaggedPrimitive,
  tp2: TaggedPrimitive,
  primitiveIntersectionResults: PrimitiveIntersectionResult[],
  maxDistance?: number,
  point?: Vec
) => {
  // TODO: Make sure the added result isn't exactly the same as the previously added result.
  for (let { time1, time2 } of primitiveIntersectionResults) {
    time1 += tp1.index;
    time2 += tp2.index;
    if (tp1.path === tp2.path) {
      // TODO: maybe time1 ~== time2
      if (time1 === time2) continue;
      if (tp1.path.closed) {
        const length = tp1.path.anchors.length;
        if (time1 === 0 && time2 === length) continue;
        if (time2 === 0 && time1 === length) continue;
      }
    }
    const position = tp1.path.positionAtTime(time1);
    if (maxDistance === undefined || point === undefined) {
      intersectionResults.push({ path1: tp1.path, path2: tp2.path, time1, time2, position });
    } else {
      const distance = position.distance(point);
      if (distance > maxDistance) continue;
      intersectionResults.push({
        path1: tp1.path,
        path2: tp2.path,
        time1,
        time2,
        position,
        distance,
      });
    }
  }
};

/**
 * Will find all intersections between segments in paths. In the
 * IntersectionResults, path1 is guaranteed to either be path2 (a
 * self-intersection) or path1 will be before path2 in the input paths.
 * Intersections will be within maxDistance of point.
 */
export const pathIntersectionsWithinDistanceToPoint = (
  paths: Path[],
  maxDistance?: number,
  point?: Vec
): IntersectionResult[] => {
  const taggedPrimitives = taggedPrimitivesFromPaths(paths, maxDistance, point);
  const intersectionResults: IntersectionResult[] = [];
  for (let i = 0, n = taggedPrimitives.length; i < n; ++i) {
    const tp1 = taggedPrimitives[i];
    if (tp1.primitive.length === 4) {
      // Cubic
      const primitiveIntersectionResults = cubicSelfIntersections(tp1.primitive);
      accumulateIntersectionResults(
        intersectionResults,
        tp1,
        tp1,
        primitiveIntersectionResults,
        maxDistance,
        point
      );
    }
    for (let j = i + 1; j < n; ++j) {
      const tp2 = taggedPrimitives[j];
      const primitiveIntersectionResults = primitivePrimitiveIntersections(
        tp1.primitive,
        tp2.primitive
      );
      accumulateIntersectionResults(
        intersectionResults,
        tp1,
        tp2,
        primitiveIntersectionResults,
        maxDistance,
        point
      );
    }
  }
  return intersectionResults;
};

/**
 * Will find all intersections between segments in paths. In the
 * IntersectionResults, path1 is guaranteed to either be path2 (a
 * self-intersection) or path1 will be before path2 in the input paths.
 */
export const pathIntersections = (paths: Path[]): IntersectionResult[] => {
  return pathIntersectionsWithinDistanceToPoint(paths);
};

/**
 * Similar to pathIntersectionsWithinDistanceToPoint except this will only look
 * for intersections between segments in paths1 with segments in paths2. In the
 * IntersectionResults, path1 will be taken from paths1 and path2 will be taken
 * from paths2.
 */
export const partitionedPathIntersectionsWithinDistanceToPoint = (
  paths1: Path[],
  paths2: Path[],
  maxDistance?: number,
  point?: Vec
): IntersectionResult[] => {
  const taggedPrimitives1 = taggedPrimitivesFromPaths(paths1, maxDistance, point);
  const taggedPrimitives2 = taggedPrimitivesFromPaths(paths2, maxDistance, point);
  const intersectionResults: IntersectionResult[] = [];
  for (let tp1 of taggedPrimitives1) {
    for (let tp2 of taggedPrimitives2) {
      const primitiveIntersectionResults = primitivePrimitiveIntersections(
        tp1.primitive,
        tp2.primitive
      );
      accumulateIntersectionResults(
        intersectionResults,
        tp1,
        tp2,
        primitiveIntersectionResults,
        maxDistance,
        point
      );
    }
  }
  return intersectionResults;
};

/**
 * Similar to pathIntersections except this will only look for intersections
 * between segments in paths1 with segments in paths2. In the
 * IntersectionResults, path1 will be taken from paths1 and path2 will be taken
 * from paths2.
 */
export const partitionedPathIntersections = (
  paths1: Path[],
  paths2: Path[]
): IntersectionResult[] => {
  return partitionedPathIntersectionsWithinDistanceToPoint(paths1, paths2);
};

//
// Bezier
//
// NOTE (ryan): I'd like to tend toward minimizing the use of the Bezier.js
// library in the future. We should incrementally move the functionality there
// into functions that operate on our own Cubic type.
//

export const bezierFromSegment = ([a1, a2]: Segment) => {
  return new Bezier(
    a1.position.x,
    a1.position.y,
    a1.position.x + a1.handleOut.x,
    a1.position.y + a1.handleOut.y,
    a2.position.x + a2.handleIn.x,
    a2.position.y + a2.handleIn.y,
    a2.position.x,
    a2.position.y
  );
};

export const vecFromBezierPoint = (point: BezierJs.Point) => {
  return new Vec(point.x, point.y);
};

const partialLengthOfBezier = (bezier: BezierJs.Bezier, endTime: number) => {
  return bezier.split(endTime).left.length(); // TODO (ryan): This could be optimized to not create intermediate beziers
};

export const distanceBetweenBezierPoints = (p1: BezierJs.Point, p2: BezierJs.Point) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};
