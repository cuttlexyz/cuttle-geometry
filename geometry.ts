import type { Anchor } from "./anchor";
import { Axis } from "./axis";
import { BoundingBox } from "./bounding-box";
import { AffineMatrix, TransformArgs } from "./matrix";
import type { Path } from "./path";
import type { Shape } from "./shape";
import { Fill, Stroke } from "./style";
import { Vec } from "./vec";

export abstract class Geometry {
  abstract clone(): Geometry;

  abstract isValid(): boolean;

  abstract closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult;

  abstract affineTransform(affineMatrix: AffineMatrix): Geometry;
  abstract affineTransformWithoutTranslation(affineMatrix: AffineMatrix): Geometry;

  transform(transform: TransformArgs): Geometry {
    return this.affineTransform(AffineMatrix.fromTransform(transform));
  }

  allShapes(): Shape[] {
    return [];
  }
  allPaths(): Path[] {
    return [];
  }
  allAnchors(): Anchor[] {
    return [];
  }
  allOrphanedAnchors(): Anchor[] {
    return [];
  }
  allShapesAndOrphanedPaths(): (Shape | Path)[] {
    return [];
  }
  allIntersectables(): (Path | Axis)[] {
    return [];
  }

  reverse(): Geometry {
    return this;
  }

  assignFill(fill: Fill): Geometry {
    return this;
  }
  removeFill() {
    return this;
  }
  assignStroke(stroke: Stroke): Geometry {
    return this;
  }
  removeStroke() {
    return this;
  }
  assignStyle(fill: Fill, stroke: Stroke): Geometry {
    return this;
  }
  copyStyle(item: Geometry): Geometry {
    return this;
  }
  scaleStroke(scaleFactor: number): Geometry {
    return this;
  }

  toSVGString(options?: ExportOptions): string {
    return "";
  }
  toSVGPathString(options?: ExportOptions): string {
    return "";
  }
  paintToCanvas(ctx: CanvasRenderingContext2D, options?: ExportOptions): void {}

  looseBoundingBox(): BoundingBox | undefined {
    return undefined;
  }
  tightBoundingBox(): BoundingBox | undefined {
    return undefined;
  }

  isContainedByBoundingBox(box: BoundingBox): boolean {
    return false;
  }
  isIntersectedByBoundingBox(box: BoundingBox): boolean {
    return false;
  }
  isOverlappedByBoundingBox(box: BoundingBox): boolean {
    return false;
  }

  containsPoint(point: Vec): boolean {
    return false;
  }
  styleContainsPoint(point: Vec): boolean {
    return false;
  }

  static isValid(a: unknown): a is Geometry {
    if (a instanceof Geometry) return a.isValid();
    return false;
  }
}

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
