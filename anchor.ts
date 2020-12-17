import { BoundingBox } from "./bounding-box";
import { DEFAULT_TOLERANCE } from "./constants";
import { ClosestPointResult, Geometry } from "./geometry";
import { AffineMatrix } from "./matrix";
import { Vec } from "./vec";

const tempHandleIn = new Vec();
const tempHandleOut = new Vec();

export class Anchor extends Geometry {
  static displayName = "Anchor";

  position: Vec;
  handleIn: Vec;
  handleOut: Vec;

  constructor(position = new Vec(), handleIn = new Vec(), handleOut = new Vec()) {
    super();
    this.position = position;
    this.handleIn = handleIn;
    this.handleOut = handleOut;
  }

  clone() {
    return new Anchor(this.position.clone(), this.handleIn.clone(), this.handleOut.clone());
  }

  isValid() {
    return Vec.isValid(this.position) && Vec.isValid(this.handleIn) && Vec.isValid(this.handleOut);
  }

  affineTransform(affineMatrix: AffineMatrix) {
    this.position.affineTransform(affineMatrix);
    this.handleIn.affineTransformWithoutTranslation(affineMatrix);
    this.handleOut.affineTransformWithoutTranslation(affineMatrix);
    return this;
  }

  affineTransformWithoutTranslation(affineMatrix: AffineMatrix) {
    this.position.affineTransformWithoutTranslation(affineMatrix);
    this.handleIn.affineTransformWithoutTranslation(affineMatrix);
    this.handleOut.affineTransformWithoutTranslation(affineMatrix);
    return this;
  }

  allAnchors() {
    return [this];
  }

  allOrphanedAnchors() {
    return [this];
  }

  looseBoundingBox() {
    return new BoundingBox(this.position.clone(), this.position.clone());
  }

  tightBoundingBox() {
    return new BoundingBox(this.position.clone(), this.position.clone());
  }

  isContainedByBoundingBox(box: BoundingBox) {
    return box.containsPoint(this.position);
  }

  isIntersectedByBoundingBox({ min, max }: BoundingBox) {
    const { x, y } = this.position;
    return (
      (x >= min.x && x <= max.x && (y === min.y || y === max.y)) ||
      (y >= min.y && y <= max.y && (x === min.x || x === max.x))
    );
  }

  isOverlappedByBoundingBox(box: BoundingBox) {
    return box.containsPoint(this.position);
  }

  closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
    const { position } = this;
    const distanceSq = position.distanceSquared(point);
    if (distanceSq <= maxDistance * maxDistance) {
      return {
        distance: Math.sqrt(distanceSq),
        position: position.clone(),
      };
    }
    return { distance: Infinity };
  }

  reverse() {
    const { handleIn, handleOut } = this;
    this.handleIn = handleOut;
    this.handleOut = handleIn;
    return this;
  }

  hasTangentHandles(tolerance = DEFAULT_TOLERANCE) {
    tempHandleIn.copy(this.handleIn).normalize();
    tempHandleOut.copy(this.handleOut).normalize();
    return tempHandleIn.dot(tempHandleOut) <= tolerance - 1;
  }

  hasZeroHandles() {
    return this.handleIn.isZero() && this.handleOut.isZero();
  }

  static isValid(a: unknown): a is Anchor {
    return a instanceof Anchor && a.isValid();
  }
}
