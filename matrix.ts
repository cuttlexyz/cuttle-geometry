import {
  DEFAULT_EPSILON,
  DEFAULT_TOLERANCE,
  DEGREES_PER_RADIAN,
  RADIANS_PER_DEGREE,
} from "./constants";
import { atan2, equalWithinRelativeEpsilon, expressionCodeForNumber, modulo, tan } from "./math";
import { Vec } from "./vec";

export interface TransformArgs {
  position?: Vec;
  rotation?: number;
  scale?: Vec | number;
  skew?: number;
  origin?: Vec;
}

export class Transform implements TransformArgs {
  position: Vec;
  rotation: number;
  scale: Vec;
  skew: number;
  origin: Vec;

  constructor(
    position: Vec,
    rotation: number,
    scale: Vec | number,
    skew: number,
    origin = new Vec()
  ) {
    this.position = position;
    this.rotation = rotation;
    if (typeof scale === "number") {
      this.scale = new Vec(scale, scale);
    } else {
      this.scale = scale;
    }
    this.skew = skew;
    this.origin = origin;
  }

  equals(transform: Transform) {
    return (
      this.position.equals(transform.position) &&
      this.rotation === transform.rotation &&
      this.scale.equals(transform.scale) &&
      this.skew === transform.skew &&
      this.origin.equals(transform.origin)
    );
  }

  equalsWithinRelativeEpsilon(transform: Transform, epsilon = DEFAULT_EPSILON) {
    return (
      this.position.equalsWithinRelativeEpsilon(transform.position, epsilon) &&
      equalWithinRelativeEpsilon(this.rotation, transform.rotation, epsilon) &&
      this.scale.equalsWithinRelativeEpsilon(transform.scale, epsilon) &&
      equalWithinRelativeEpsilon(this.skew, transform.skew, epsilon) &&
      this.origin.equalsWithinRelativeEpsilon(transform.origin, epsilon)
    );
  }
}

export class AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;

  /**
   * Creates a matrix of the form:
   * |a  c  tx|
   * |b  d  ty|
   * |0  0  1 |
   * @param a x component of the first basis vector
   * @param b y component of the first basis vector
   * @param c x component of the second basis vector
   * @param d y component of the second basis vector
   * @param tx translation on the x axis
   * @param ty translation on the y axis
   */
  constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }

  clone() {
    return new AffineMatrix(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }

  invert() {
    const { a, b, c, d, tx, ty } = this;
    const ad_minus_bc = a * d - b * c;
    const bc_minus_ad = b * c - a * d;

    this.a = d / ad_minus_bc;
    this.b = b / bc_minus_ad;
    this.c = c / bc_minus_ad;
    this.d = a / ad_minus_bc;
    this.tx = (d * tx - c * ty) / bc_minus_ad;
    this.ty = (b * tx - a * ty) / ad_minus_bc;

    return this;
  }

  mul(m: AffineMatrix) {
    const { a, b, c, d, tx, ty } = this;
    const { a: A, b: B, c: C, d: D, tx: TX, ty: TY } = m;

    this.a = a * A + c * B;
    this.b = b * A + d * B;
    this.c = a * C + c * D;
    this.d = b * C + d * D;
    this.tx = a * TX + c * TY + tx;
    this.ty = b * TX + d * TY + ty;

    return this;
  }

  preMul(m: AffineMatrix) {
    const { a, b, c, d, tx, ty } = m;
    const { a: A, b: B, c: C, d: D, tx: TX, ty: TY } = this;

    this.a = a * A + c * B;
    this.b = b * A + d * B;
    this.c = a * C + c * D;
    this.d = b * C + d * D;
    this.tx = a * TX + c * TY + tx;
    this.ty = b * TX + d * TY + ty;

    return this;
  }

  translate(v: Vec) {
    const { x, y } = v;
    const { a, b, c, d } = this;
    this.tx += a * x + c * y;
    this.ty += b * x + d * y;
    return this;
  }

  preTranslate(v: Vec) {
    this.tx += v.x;
    this.ty += v.y;
    return this;
  }

  scale(v: Vec) {
    this.a *= v.x;
    this.b *= v.x;
    this.c *= v.y;
    this.d *= v.y;
    return this;
  }

  scaleScalar(s: number) {
    this.a *= s;
    this.b *= s;
    this.c *= s;
    this.d *= s;
    return this;
  }

  normalize() {
    const { a, b, c, d } = this;
    let m = a * a + b * b;
    if (m > 0) {
      m = 1 / Math.sqrt(m);
      this.a *= m;
      this.b *= m;
    }
    m = c * c + d * d;
    if (m > 0) {
      m = 1 / Math.sqrt(m);
      this.c *= m;
      this.d *= m;
    }
    return this;
  }

  rotate(angle: number) {
    this.mul(AffineMatrix.fromRotation(angle));
    return this;
  }

  skew(angle: number) {
    const s = Math.tan(angle * RADIANS_PER_DEGREE);
    this.c += s * this.a;
    this.d += s * this.b;
    return this;
  }

  origin(origin: Vec) {
    const ox = -origin.x;
    const oy = -origin.y;
    this.tx += this.a * ox + this.c * oy;
    this.ty += this.b * ox + this.d * oy;
    return this;
  }

  changeBasis(changeOfBasisMatrix: AffineMatrix, inverseChangeOfBasisMatrix?: AffineMatrix) {
    if (inverseChangeOfBasisMatrix === undefined) {
      inverseChangeOfBasisMatrix = changeOfBasisMatrix.clone().invert();
    }
    return this.preMul(inverseChangeOfBasisMatrix).mul(changeOfBasisMatrix);
  }

  /**
   * Ensure that the basis vectors of this matrix are at least as long as the
   * specified length. If a vector is shorter than the specified length it will
   * be set perpendicular to the opposing vector. If both are shorter they will
   * be set to the identity matrix scaled by length.
   * @param length The minimum length the basis vectors will have after this
   * method is called
   */
  ensureMinimumBasisLength(length: number) {
    const { a, b, c, d } = this;
    const xLen = Math.sqrt(a * a + b * b);
    const yLen = Math.sqrt(c * c + d * d);
    if (xLen < length && yLen < length) {
      this.a = length;
      this.b = 0;
      this.c = 0;
      this.d = length;
    } else if (xLen < length) {
      const scale = length / yLen;
      this.a = d * scale;
      this.b = -c * scale;
    } else if (yLen < length) {
      const scale = length / xLen;
      this.c = -b * scale;
      this.d = a * scale;
    }
    return this;
  }

  determinant() {
    const { a, b, c, d } = this;
    return a * d - b * c;
  }

  equals(m: AffineMatrix) {
    return (
      this.a === m.a &&
      this.b === m.b &&
      this.c === m.c &&
      this.d === m.d &&
      this.tx === m.tx &&
      this.ty === m.ty
    );
  }

  isOrthogonal(tolerance = DEFAULT_TOLERANCE) {
    const { a, b, c, d } = this;
    return Math.abs(a * c + b * d) <= tolerance;
  }

  isInvertible() {
    return this.determinant() !== 0;
  }

  isUniformScale(tolerance = DEFAULT_TOLERANCE) {
    const { a, b, c, d } = this;
    return Math.abs(a * a + b * b - (c * c + d * d)) <= tolerance;
  }

  isMirror() {
    return this.determinant() < 0;
  }

  isIdentity() {
    return (
      this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.tx === 0 && this.ty === 0
    );
  }

  isNaN() {
    return (
      isNaN(this.a) ||
      isNaN(this.b) ||
      isNaN(this.c) ||
      isNaN(this.d) ||
      isNaN(this.tx) ||
      isNaN(this.ty)
    );
  }

  /**
   * Returns a transform `{position, rotation, scale, skew}` such that
   * `AffineMatrix.fromTransform(transform)` will return the original matrix. It
   * guarantees:
   *
   * - `0 <= rotation < 360`
   * - `-90 < skew < 90` (assuming the matrix basis vectors are not collinear)
   *
   * Notes:
   *
   * - This will return only one of two possible solutions. You can get the
   *   other one by negating `scale` and rotating by `180` degrees.
   * - If either of the basis vectors are degenerate (close to zero length),
   *   then this will set `skew` to `0`.
   * - If both of the basis vectors are degenerate, this will set `rotation` to
   *   `0`.
   * - `scale` will always be returned as a `Vec`.
   */
  toTransform(): Transform {
    const { a, b, c, d, tx, ty } = this;

    const xBasisIsUsable = a * a + b * b > 1e-7;
    const yBasisIsUsable = c * c + d * d > 1e-7;

    // If neither the x basis or y basis are usable, we'll assume rotation is 0.
    // If only one is usable, we'll use that to determine rotation and assume
    // skew is 0. So we'll only return non-zero skew if both the x and y bases
    // are usable.
    let rotationRadians = 0;
    let skew = 0;
    if (xBasisIsUsable) {
      rotationRadians = Math.atan2(b, a);
      if (yBasisIsUsable) {
        skew = (rotationRadians - Math.atan2(-c, d)) * DEGREES_PER_RADIAN;
        // Put skew in canonical range: -90 < skew < 90.
        skew = modulo(skew, 180);
        if (skew > 90) skew -= 180;
      }
    } else if (yBasisIsUsable) {
      // Since the x basis is unusable, we'll use the y basis rotated -90° to
      // determine rotation.
      rotationRadians = Math.atan2(-c, d);
    }

    const position = new Vec(tx, ty);

    const ct = Math.cos(-rotationRadians);
    const st = Math.sin(-rotationRadians);
    const rotation = modulo(rotationRadians * DEGREES_PER_RADIAN, 360);

    const sx = a * ct - b * st;
    const sy = c * st + d * ct;
    const scale = new Vec(sx, sy);

    return new Transform(position, rotation, scale, skew);
  }

  toTransformWithOrigin(origin: Vec): Transform {
    const m = this.clone().translate(origin);
    const transform = m.toTransform();
    transform.origin = origin.clone();
    return transform;
  }

  toExpressionCode(minimumFractionDigits?: number, maximumFractionDigits?: number) {
    const { a, b, c, d, tx, ty } = this;
    const expr = (x: number) => {
      return expressionCodeForNumber(a, minimumFractionDigits, maximumFractionDigits);
    };
    return `AffineMatrix(${expr(a)}, ${expr(b)}, ${expr(c)}, ${expr(d)}, ${expr(tx)}, ${expr(ty)})`;
  }

  toCSSString() {
    const { a, b, c, d, tx, ty } = this;
    return `matrix(${expressionCodeForNumber(a)} ${expressionCodeForNumber(
      b
    )} ${expressionCodeForNumber(c)} ${expressionCodeForNumber(d)} ${expressionCodeForNumber(
      tx
    )} ${expressionCodeForNumber(ty)})`;
  }

  static inverse(matrix: AffineMatrix) {
    return matrix.clone().invert();
  }

  static fromTransform({ position, rotation, scale, skew, origin }: TransformArgs) {
    const m = new AffineMatrix();
    if (position instanceof Vec) {
      m.translate(position);
    }
    if (typeof rotation === "number") {
      m.rotate(rotation);
    }
    if (typeof skew === "number") {
      m.skew(skew);
    }
    if (scale instanceof Vec) {
      m.scale(scale);
    } else if (typeof scale === "number") {
      m.scaleScalar(scale);
    }
    if (origin instanceof Vec) {
      m.origin(origin);
    }
    return m;
  }

  static fromTranslation(translation: Vec) {
    return new AffineMatrix(1, 0, 0, 1, translation.x, translation.y);
  }
  static fromTranslationPoints = (p1: Vec, p2: Vec) => {
    return new AffineMatrix(1, 0, 0, 1, p2.x - p1.x, p2.y - p1.y);
  };

  static fromRotation(angle: number) {
    const radians = angle * RADIANS_PER_DEGREE;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return new AffineMatrix(c, s, -s, c, 0, 0);
  }

  static fromCenterScale(center: Vec, scale: Vec) {
    const { x, y } = center;
    const { x: sx, y: sy } = scale;
    return new AffineMatrix(sx, 0, 0, sy, x - x * sx, y - y * sy);
  }

  static fromCenterAndReferencePoints(
    center: Vec,
    p1: Vec,
    p2: Vec,
    allowRotate = true,
    allowScale = true,
    uniformScale = true
  ) {
    const v1 = p1.clone().sub(center);
    const v2 = p2.clone().sub(center);

    const rotation1 = atan2(v1.y, v1.x);
    const rotation2 = allowRotate ? atan2(v2.y, v2.x) : rotation1;

    let scale = 1;
    if (allowScale) {
      if (allowRotate) {
        scale = v2.length() / v1.length();
      } else {
        scale = v1.dot(v2) / v1.dot(v1);
      }
    }

    const matrix1 = AffineMatrix.fromTransform({ position: center, rotation: rotation1 });
    const matrix2 = AffineMatrix.fromTransform({
      position: center,
      rotation: rotation2,
      scale: new Vec(scale, uniformScale ? scale : 1),
    });
    return matrix1.invert().preMul(matrix2);
  }

  static fromCenterAndRotationPoints(center: Vec, p1: Vec, p2: Vec) {
    const { x, y } = center;
    const t1 = Math.atan2(p1.y - y, p1.x - x);
    const t2 = Math.atan2(p2.y - y, p2.x - x);
    const radians = t2 - t1;
    const ct = Math.cos(radians);
    const st = Math.sin(radians);
    return new AffineMatrix(ct, st, -st, ct, x - x * ct + y * st, y - x * st - y * ct);
  }

  static fromCenterAndQuantizedRotationPoints(
    center: Vec,
    p1: Vec,
    p2: Vec,
    incrementDegrees: number
  ) {
    const { x, y } = center;
    const t1 = Math.atan2(p1.y - y, p1.x - x);
    const t2 = Math.atan2(p2.y - y, p2.x - x);
    const radians =
      Math.round(((t2 - t1) * DEGREES_PER_RADIAN) / incrementDegrees) *
      incrementDegrees *
      RADIANS_PER_DEGREE;
    const ct = Math.cos(radians);
    const st = Math.sin(radians);
    return new AffineMatrix(ct, st, -st, ct, x - x * ct + y * st, y - x * st - y * ct);
  }

  static fromCenterAndUniformScalePoints(center: Vec, p1: Vec, p2: Vec) {
    const { x, y } = center;
    const sx = (p2.x - x) / (p1.x - x);
    const sy = (p2.y - y) / (p1.y - y);
    const s = Math.min(sx, sy);
    return new AffineMatrix(s, 0, 0, s, x - x * s, y - y * s);
  }

  static fromCenterAndNonUniformScalePoints(center: Vec, p1: Vec, p2: Vec) {
    const { x, y } = center;
    const dx = p1.x - x;
    const dy = p1.y - y;
    const sx = dx === 0 ? 1 : (p2.x - x) / dx;
    const sy = dy === 0 ? 1 : (p2.y - y) / dy;
    return new AffineMatrix(sx, 0, 0, sy, x - x * sx, y - y * sy);
  }

  static fromCenterAndYAxis(center: Vec, yAxis: Vec) {
    return new AffineMatrix(yAxis.y, -yAxis.x, yAxis.x, yAxis.y, center.x, center.y);
  }

  static mul(a: AffineMatrix, b: AffineMatrix) {
    return a.clone().mul(b);
  }

  static isValid(m: unknown): m is AffineMatrix {
    return (
      m instanceof AffineMatrix &&
      typeof m.a === "number" &&
      isFinite(m.a) &&
      typeof m.b === "number" &&
      isFinite(m.b) &&
      typeof m.c === "number" &&
      isFinite(m.c) &&
      typeof m.d === "number" &&
      isFinite(m.d) &&
      typeof m.tx === "number" &&
      isFinite(m.tx) &&
      typeof m.ty === "number" &&
      isFinite(m.ty)
    );
  }

  // via https://github.com/fontello/svgpath
  static fromSVGTransformString(transformString: string) {
    const operations: { [op: string]: boolean } = {
      matrix: true,
      scale: true,
      rotate: true,
      translate: true,
      skewX: true,
      skewY: true,
    };
    const CMD_SPLIT_RE = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/;
    const PARAMS_SPLIT_RE = /[\s,]+/;

    const result = new AffineMatrix();
    let cmd: string;
    transformString.split(CMD_SPLIT_RE).forEach((item) => {
      if (!item.length) return;
      if (operations[item]) {
        cmd = item;
        return;
      }

      const params = item.split(PARAMS_SPLIT_RE).map((i) => +i || 0);
      if (cmd === "matrix" && params.length === 6) {
        result.mul(
          new AffineMatrix(params[0], params[1], params[2], params[3], params[4], params[5])
        );
      } else if (cmd === "scale") {
        if (params.length === 1) {
          result.scale(new Vec(params[0]));
        } else if (params.length === 2) {
          result.scale(new Vec(params[0], params[1]));
        }
      } else if (cmd === "rotate") {
        if (params.length === 1) {
          result.rotate(params[0]);
        } else if (params.length === 3) {
          result.translate(new Vec(params[1], params[2]));
          result.rotate(params[0]);
          result.translate(new Vec(-params[1], -params[2]));
        }
      } else if (cmd === "translate") {
        if (params.length === 1) {
          result.translate(new Vec(params[0], 0));
        } else if (params.length === 2) {
          result.translate(new Vec(params[0], params[1]));
        }
      } else if (cmd === "skewX") {
        if (params.length === 1) {
          result.mul(new AffineMatrix(1, 0, tan(params[0]), 1, 0, 0));
        }
      } else if (cmd === "skewY") {
        if (params.length === 1) {
          result.mul(new AffineMatrix(1, tan(params[0]), 0, 1, 0, 0));
        }
      }
    });

    return result;
  }
}
