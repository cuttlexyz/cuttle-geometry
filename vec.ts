import {
  DEFAULT_EPSILON,
  DEFAULT_TOLERANCE,
  DEGREES_PER_RADIAN,
  RADIANS_PER_DEGREE,
} from "./constants";
import { equalWithinRelativeEpsilon, expressionCodeForNumber, saturate } from "./math";
import { AffineMatrix, TransformArgs } from "./matrix";

export class Vec {
  x: number;
  y: number;

  constructor(x?: number, y?: number) {
    this.x = x || 0;
    this.y = y === undefined ? this.x : y;
  }

  clone() {
    return new Vec(this.x, this.y);
  }

  set(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  affineTransform(affineMatrix: AffineMatrix) {
    const { x, y } = this;
    const { a, b, c, d, tx, ty } = affineMatrix;
    this.x = a * x + c * y + tx;
    this.y = b * x + d * y + ty;
    return this;
  }

  affineTransformWithoutTranslation(affineMatrix: AffineMatrix) {
    const { x, y } = this;
    const { a, b, c, d } = affineMatrix;
    this.x = a * x + c * y;
    this.y = b * x + d * y;
    return this;
  }

  transform(transform: TransformArgs) {
    return this.affineTransform(AffineMatrix.fromTransform(transform));
  }

  add(v: Vec) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  addScalar(x: number) {
    this.x += x;
    this.y += x;
    return this;
  }
  sub(v: Vec) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  subScalar(x: number) {
    this.x -= x;
    this.y -= x;
    return this;
  }
  mul(v: Vec) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }
  mulScalar(x: number) {
    this.x *= x;
    this.y *= x;
    return this;
  }
  div(v: Vec) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  divScalar(x: number) {
    this.x /= x;
    this.y /= x;
    return this;
  }

  negate() {
    this.x *= -1;
    this.y *= -1;
    return this;
  }

  equals(v: Vec) {
    return this.x === v.x && this.y === v.y;
  }
  equalsWithinTolerance(v: Vec, tolerance = DEFAULT_TOLERANCE) {
    return Math.abs(this.x - v.x) <= tolerance && Math.abs(this.y - v.y) <= tolerance;
  }
  equalsWithinRelativeEpsilon(v: Vec, epsilon = DEFAULT_EPSILON) {
    return (
      equalWithinRelativeEpsilon(this.x, v.x, epsilon) &&
      equalWithinRelativeEpsilon(this.y, v.y, epsilon)
    );
  }

  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }
  roundToFixed(fractionDigits: number) {
    const scale = Math.pow(10, fractionDigits);
    const oneOverScale = 1 / scale;
    this.x = Math.round(this.x * scale) * oneOverScale;
    this.y = Math.round(this.y * scale) * oneOverScale;
    return this;
  }

  min(v: Vec) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    return this;
  }
  max(v: Vec) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    return this;
  }

  mix(v: Vec, t: number) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  dot(v: Vec) {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vec) {
    return this.x * v.y + this.y * v.x;
  }

  normalize() {
    const lengthSq = this.lengthSquared();
    if (lengthSq > 0) {
      this.mulScalar(1 / Math.sqrt(lengthSq));
    }
    return this;
  }

  rotate(degrees: number) {
    return this.rotateRadians(degrees * RADIANS_PER_DEGREE);
  }
  rotateRadians(radians: number) {
    const ct = Math.cos(radians);
    const st = Math.sin(radians);
    const { x, y } = this;
    this.x = x * ct - y * st;
    this.y = x * st + y * ct;
    return this;
  }
  rotate90() {
    const { x, y } = this;
    this.x = -y;
    this.y = x;
    return this;
  }
  rotateNeg90() {
    const { x, y } = this;
    this.x = y;
    this.y = -x;
    return this;
  }

  angle() {
    return this.angleRadians() * DEGREES_PER_RADIAN;
  }
  angleRadians() {
    return Math.atan2(this.y, this.x);
  }

  length() {
    const { x, y } = this;
    return Math.sqrt(x * x + y * y);
  }
  lengthSquared() {
    const { x, y } = this;
    return x * x + y * y;
  }

  distance(v: Vec) {
    const dx = v.x - this.x;
    const dy = v.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  distanceSquared(v: Vec) {
    const dx = v.x - this.x;
    const dy = v.y - this.y;
    return dx * dx + dy * dy;
  }

  timeAtClosestPointOnLineSegment(a: Vec, b: Vec) {
    const pax = this.x - a.x;
    const pay = this.y - a.y;
    const bax = b.x - a.x;
    const bay = b.y - a.y;
    return (pax * bax + pay * bay) / (bax * bax + bay * bay);
  }
  distanceToLineSegment(a: Vec, b: Vec) {
    const pax = this.x - a.x;
    const pay = this.y - a.y;
    const bax = b.x - a.x;
    const bay = b.y - a.y;
    const h = saturate((pax * bax + pay * bay) / (bax * bax + bay * bay));
    const dx = pax - bax * h;
    const dy = pay - bay * h;
    return Math.sqrt(dx * dx + dy * dy);
  }
  projectToLineSegment(a: Vec, b: Vec) {
    const pax = this.x - a.x;
    const pay = this.y - a.y;
    const bax = b.x - a.x;
    const bay = b.y - a.y;
    const h = saturate((pax * bax + pay * bay) / (bax * bax + bay * bay));
    this.x = a.x + bax * h;
    this.y = a.y + bay * h;
    return this;
  }
  projectToLine(a: Vec, b: Vec) {
    const pax = this.x - a.x;
    const pay = this.y - a.y;
    const bax = b.x - a.x;
    const bay = b.y - a.y;
    const h = (pax * bax + pay * bay) / (bax * bax + bay * bay);
    this.x = a.x + bax * h;
    this.y = a.y + bay * h;
    return this;
  }

  isZero() {
    return this.x === 0 && this.y === 0;
  }

  isFinite() {
    return Number.isFinite(this.x) && Number.isFinite(this.y);
  }

  toExpressionCode(minimumFractionDigits?: number, maximumFractionDigits?: number) {
    return `Vec(${expressionCodeForNumber(
      this.x,
      minimumFractionDigits,
      maximumFractionDigits
    )}, ${expressionCodeForNumber(this.y, minimumFractionDigits, maximumFractionDigits)})`;
  }

  static add(a: Vec, b: Vec) {
    return a.clone().add(b);
  }
  static sub(a: Vec, b: Vec) {
    return a.clone().sub(b);
  }
  static mul(a: Vec, b: Vec) {
    return a.clone().mul(b);
  }
  static div(a: Vec, b: Vec) {
    return a.clone().div(b);
  }

  static min(a: Vec, b: Vec) {
    return a.clone().min(b);
  }
  static max(a: Vec, b: Vec) {
    return a.clone().max(b);
  }
  static mix(a: Vec, b: Vec, t: number) {
    return a.clone().mix(b, t);
  }

  static dot(a: Vec, b: Vec) {
    return a.dot(b);
  }

  static rotate(v: Vec, degrees: number) {
    return v.clone().rotate(degrees);
  }
  static rotateRadians(v: Vec, radians: number) {
    return v.clone().rotateRadians(radians);
  }
  static rotate90(v: Vec) {
    return new Vec(-v.y, v.x);
  }

  static fromAngle(angle: number) {
    return Vec.fromAngleRadians(angle * RADIANS_PER_DEGREE);
  }
  static fromAngleRadians(angle: number) {
    return new Vec(Math.cos(angle), Math.sin(angle));
  }

  static isValid(v: unknown): v is Vec {
    return (
      v instanceof Vec &&
      typeof v.x === "number" &&
      isFinite(v.x) &&
      typeof v.y === "number" &&
      isFinite(v.y)
    );
  }
}
