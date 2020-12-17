import { Geometry } from "./geometry";
import { AffineMatrix } from "./matrix";
import { Vec } from "./vec";

const defaultDirections = [
  new Vec(1, 0),
  new Vec(0, 1),
  new Vec(1, 1).normalize(),
  new Vec(1, -1).normalize(),
];

export class Axis extends Geometry {
  static displayName = "Axis";

  origin: Vec;
  direction: Vec;

  constructor(origin: Vec = new Vec(), direction: Vec = new Vec(1, 0)) {
    super();
    this.origin = origin;
    this.direction = direction;
  }

  clone() {
    return new Axis(this.origin.clone(), this.direction.clone());
  }

  isValid() {
    return Vec.isValid(this.origin) && Vec.isValid(this.direction);
  }

  affineTransform(matrix: AffineMatrix) {
    this.origin.affineTransform(matrix);
    this.direction.affineTransformWithoutTranslation(matrix);
    return this;
  }
  affineTransformWithoutTranslation(matrix: AffineMatrix) {
    this.direction.affineTransformWithoutTranslation(matrix);
    return this;
  }

  closestPointWithinDistanceToPoint(maxDistance: number, point: Vec) {
    const position = point
      .clone()
      .projectToLine(this.origin, this.origin.clone().add(this.direction));
    const distance = point.distance(position);
    if (distance <= maxDistance) {
      return { position, distance };
    }
    return { distance: Infinity };
  }

  allIntersectables() {
    return [this];
  }

  static fromOriginAndClosestDirectionToPoint(
    origin: Vec,
    point: Vec,
    directions = defaultDirections
  ) {
    let direction = point.clone().sub(origin);
    let closestAxis = directions[0];
    let closestMag = -1;
    let closestD = 0;
    for (let axis of directions) {
      const d = axis.dot(direction);
      const mag = Math.abs(d);
      if (mag > closestMag) {
        closestAxis = axis;
        closestMag = mag;
        closestD = d;
      }
    }
    direction.copy(closestAxis).mulScalar(closestD);
    return new Axis(origin, direction);
  }
}
