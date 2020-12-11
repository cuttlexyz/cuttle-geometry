import { Cubic } from "./segment";
import { Vec } from "./vec";

// Closest Point Helper Functions
// Largely from "A Bezier Curve-Based Root-Finder" by Philip J. Schneider
// Published in "Graphics Gems" (1995)
// https://github.com/erich666/GraphicsGems/blob/master/gems/NearestPoint.c

export const bernsteinBezierFormForClosestPointOnCubic = (point: Vec, cubic: Cubic) => {
  const z = [
    /* Precomputed "z" for cubics	*/ [1.0, 0.6, 0.3, 0.1],
    [0.4, 0.6, 0.6, 0.4],
    [0.1, 0.3, 0.6, 1.0],
  ];

  const c = cubic.map((v) => v.clone().sub(point));
  const d = new Vec();
  const cDotD = Array<number[]>(3);
  for (let j = 0; j < 3; ++j) {
    d.copy(cubic[j + 1])
      .sub(cubic[j])
      .mulScalar(3);
    const row = (cDotD[j] = new Array<number>(4));
    for (let i = 0; i < 4; ++i) {
      row[i] = d.dot(c[i]);
    }
  }

  const w = new Array<Vec>(6);
  for (let i = 0; i <= 5; ++i) {
    w[i] = new Vec(i / 5, 0);
  }

  const n = 3;
  const n1 = n - 1;
  for (let k = 0; k <= n + n1; ++k) {
    const lb = Math.max(0, k - n1);
    const ub = Math.min(k, n);
    for (let i = lb; i <= ub; ++i) {
      const j = k - i;
      w[i + j].y += cDotD[j][i] * z[j][i];
    }
  }

  return w;
};

const FIND_ROOTS_MAX_DEPTH = 64;
const FIND_ROOTS_EPSILON = Math.pow(2, -FIND_ROOTS_MAX_DEPTH - 1);

/*
 *  FindRoots :
 *	Given a 5th-degree equation in Bernstein-Bezier form, find
 *	all of the roots in the interval [0, 1].  Return the number
 *	of roots found.
 */
export const findRoots = (w: Vec[], degree: number, depth: number = 0): number[] => {
  const crossingCount = zeroCrossingCount(w);
  if (crossingCount === 0) return [];
  if (crossingCount === 1) {
    if (depth >= FIND_ROOTS_MAX_DEPTH) {
      return [(w[0].x + w[degree].x) / 2];
    }
    if (isControlPolygonFlatEnough(w, degree)) {
      return [computeXIntercept(w, degree)];
    }
  }

  /* Otherwise, solve recursively after	*/
  /* subdividing control polygon		*/

  const [pointsLeft, pointsRight] = splitBezier(w, 0.5);

  const leftRoots = findRoots(pointsLeft, degree, depth + 1);
  const rightRoots = findRoots(pointsRight, degree, depth + 1);

  return leftRoots.concat(rightRoots);
};

const zeroCrossingCount = (points: Vec[]) => {
  let count = 0;
  let prevSign = Math.sign(points[0].y);

  for (let i = 1; i < points.length; ++i) {
    const sign = Math.sign(points[i].y);
    if (sign !== prevSign) {
      ++count;
      prevSign = sign;
    }
  }

  return count;
};

/*
 *  ControlPolygonFlatEnough :
 *	Check if the control polygon of a Bezier curve is flat enough
 *	for recursive subdivision to bottom out.
 *
 *  Corrections by James Walker, jw@jwwalker.com, as follows:

There seem to be errors in the ControlPolygonFlatEnough function in the
Graphics Gems book and the repository (NearestPoint.c). This function
is briefly described on p. 413 of the text, and appears on pages 793-794.
I see two main problems with it.

The idea is to find an upper bound for the error of approximating the x
intercept of the Bezier curve by the x intercept of the line through the
first and last control points. It is claimed on p. 413 that this error is
bounded by half of the difference between the intercepts of the bounding
box. I don't see why that should be true. The line joining the first and
last control points can be on one side of the bounding box, and the actual
curve can be near the opposite side, so the bound should be the difference
of the bounding box intercepts, not half of it.

Second, we come to the implementation. The values distance[i] computed in
the first loop are not actual distances, but squares of distances. I
realize that minimizing or maximizing the squares is equivalent to
minimizing or maximizing the distances.  But when the code claims that
one of the sides of the bounding box has equation
a * x + b * y + c + max_distance_above, where max_distance_above is one of
those squared distances, that makes no sense to me.

I have appended my version of the function. If you apply my code to the
cubic Bezier curve used to test NearestPoint.c,

 static Point2 bezCurve[4] = {    /  A cubic Bezier curve    /
    { 0.0, 0.0 },
    { 1.0, 2.0 },
    { 3.0, 3.0 },
    { 4.0, 2.0 },
    };

my code computes left_intercept = -3.0 and right_intercept = 0.0, which you
can verify by sketching a graph. The original code computes
left_intercept = 0.0 and right_intercept = 0.9.

 */
const isControlPolygonFlatEnough = (points: Vec[], degree: number) => {
  /* Derive the implicit equation for line connecting first and last control points */
  const a = points[0].y - points[degree].y;
  const b = points[degree].x - points[0].x;
  const c = points[0].x * points[degree].y - points[degree].x * points[0].y;

  let max_distance_above = 0;
  let max_distance_below = 0;

  for (let i = 1; i < degree; i++) {
    const value = a * points[i].x + b * points[i].y + c;
    if (value > max_distance_above) {
      max_distance_above = value;
    } else if (value < max_distance_below) {
      max_distance_below = value;
    }
  }

  /*  Implicit equation for zero line */
  const a1 = 0.0;
  const b1 = 1.0;
  const c1 = 0.0;

  /*  Implicit equation for "above" line */
  let a2 = a;
  let b2 = b;
  let c2 = c - max_distance_above;

  let det = a1 * b2 - a2 * b1;
  let dInv = 1.0 / det;

  const intercept_1 = (b1 * c2 - b2 * c1) * dInv;

  /*  Implicit equation for "below" line */
  a2 = a;
  b2 = b;
  c2 = c - max_distance_below;

  det = a1 * b2 - a2 * b1;
  dInv = 1.0 / det;

  const intercept_2 = (b1 * c2 - b2 * c1) * dInv;

  /* Compute intercepts of bounding box */
  const left_intercept = Math.min(intercept_1, intercept_2);
  const right_intercept = Math.max(intercept_1, intercept_2);

  const error = right_intercept - left_intercept;

  return error < FIND_ROOTS_EPSILON;
};

/*
 *  ComputeXIntercept :
 *	Compute intersection of chord from first control point to last with 0-axis.
 */
const computeXIntercept = (points: Vec[], degree: number) => {
  const p0 = points[0];
  const p1 = points[degree];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const det = -dy;
  return (dx * p0.y - dy * p0.x) / det;
};

export const splitBezier = (points: Vec[], t: number) => {
  const scratch = new Array<Vec[]>(points.length);
  const degree = points.length - 1;

  /* Copy control points	*/
  scratch[0] = new Array<Vec>(points.length);
  for (let i = 0; i <= degree; ++i) {
    scratch[0][i] = points[i].clone();
  }

  /* Triangle computation	*/
  for (let j = 1; j <= degree; ++j) {
    const n = degree - j + 1;
    scratch[j] = new Array<Vec>(n);
    for (let i = 0; i < n; ++i) {
      scratch[j][i] = scratch[j - 1][i].clone().mix(scratch[j - 1][i + 1], t);
    }
  }

  // const midPoint = scratch[degree][0];

  const pointsLeft = new Array<Vec>(degree + 1);
  const pointsRight = new Array<Vec>(degree + 1);
  for (let j = 0; j <= degree; ++j) {
    pointsLeft[j] = scratch[j][0];
    pointsRight[j] = scratch[degree - j][j];
  }

  return [pointsLeft, pointsRight];
};
