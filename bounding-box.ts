import { Vec } from "./vec";

export class BoundingBox {
  min: Vec;
  max: Vec;

  constructor(min = new Vec(), max = new Vec()) {
    this.min = min;
    this.max = max;
  }

  clone() {
    return new BoundingBox(this.min.clone(), this.max.clone());
  }

  center() {
    return this.min.clone().add(this.max).mulScalar(0.5);
  }

  size() {
    return this.max.clone().sub(this.min);
  }

  width() {
    return this.max.x - this.min.x;
  }
  height() {
    return this.max.y - this.min.y;
  }

  isFinite() {
    return this.min.isFinite() && this.max.isFinite();
  }

  canonicalize() {
    const { x: x1, y: y1 } = this.min;
    const { x: x2, y: y2 } = this.max;
    this.min.set(Math.min(x1, x2), Math.min(y1, y2));
    this.max.set(Math.max(x1, x2), Math.max(y1, y2));
    return this;
  }

  expandToIncludePoint(point: Vec) {
    this.min.min(point);
    this.max.max(point);
    return this;
  }

  expandToIncludeBoundingBox(box: BoundingBox) {
    return this.expandToIncludePoint(box.min).expandToIncludePoint(box.max);
  }

  expandScalar(distance: number) {
    this.min.subScalar(distance);
    this.max.addScalar(distance);
    return this;
  }

  containsPoint({ x, y }: Vec) {
    return x >= this.min.x && x <= this.max.x && y >= this.min.y && y <= this.max.y;
  }

  containsBoundingBox({ min, max }: BoundingBox) {
    return min.x >= this.min.x && max.x <= this.max.x && min.y >= this.min.y && max.y <= this.max.y;
  }

  overlapsBoundingBox({ min, max }: BoundingBox) {
    return max.x >= this.min.x && min.x <= this.max.x && max.y >= this.min.y && min.y <= this.max.y;
  }

  static fromPoints(points: Vec[]) {
    if (points.length === 0) return null;
    const box = new BoundingBox(points[0].clone(), points[0].clone());
    for (let i = 1, n = points.length; i < n; ++i) {
      box.expandToIncludePoint(points[i]);
    }
    return box;
  }

  static fromCubic([p1, p2, p3, p4]: Cubic) {
    return new BoundingBox(
      new Vec(Math.min(p1.x, p2.x, p3.x, p4.x), Math.min(p1.y, p2.y, p3.y, p4.y)),
      new Vec(Math.max(p1.x, p2.x, p3.x, p4.x), Math.max(p1.y, p2.y, p3.y, p4.y))
    );
  }
}

// Redeclare Cubic type here to avoid importing segment.ts which includes Anchor.
type Cubic = [Vec, Vec, Vec, Vec];
