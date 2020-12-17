import { opentype } from "../deps";
import { BoundingBox } from "./bounding-box";
import { dummyCanvasCtx, paintToCanvas, styleContainsPoint } from "./canvas";
import { ClosestPointResult, ExportOptions, Geometry } from "./geometry";
import { Group } from "./group";
import { AffineMatrix } from "./matrix";
import { Path } from "./path";
import {
  computeTightBoundingBox,
  deletePkPath,
  emptyPkPath,
  fromPkCommands,
  fromPkPath,
  PathKit,
  performStroke,
  pkPathFromSVGPathString,
  toPkPath,
} from "./pathkit";
import { Fill, Stroke } from "./style";
import { pathOrShapeToSVGString } from "./svg";
import { Vec } from "./vec";

export class Shape extends Geometry {
  static displayName = "Shape";

  paths: Path[];

  stroke?: Stroke;
  fill?: Fill;

  constructor(paths: Path[] = [], stroke?: Stroke, fill?: Fill) {
    super();
    this.paths = paths;
    this.stroke = stroke;
    this.fill = fill;
  }

  clone() {
    return new Shape(
      this.paths.map((path) => path.clone()),
      this.stroke?.clone(),
      this.fill?.clone()
    );
  }

  isValid() {
    return (
      Array.isArray(this.paths) &&
      this.paths.every(Path.isValid) &&
      (this.stroke === undefined || Stroke.isValid(this.stroke)) &&
      (this.fill === undefined || Fill.isValid(this.fill))
    );
  }

  affineTransform(affineMatrix: AffineMatrix) {
    for (let path of this.paths) path.affineTransform(affineMatrix);
    return this;
  }

  affineTransformWithoutTranslation(affineMatrix: AffineMatrix) {
    for (let path of this.paths) path.affineTransformWithoutTranslation(affineMatrix);
    return this;
  }

  allShapes() {
    return [this];
  }

  allPaths() {
    return [...this.paths];
  }

  allAnchors() {
    return this.paths.flatMap((p) => p.anchors);
  }

  allShapesAndOrphanedPaths() {
    return [this];
  }

  allIntersectables() {
    return [...this.paths];
  }

  assignFill(fill: Fill) {
    this.fill = fill.clone();
    return this;
  }
  removeFill() {
    this.fill = undefined;
    return this;
  }

  assignStroke(stroke: Stroke) {
    this.stroke = stroke.clone();
    return this;
  }
  removeStroke() {
    this.stroke = undefined;
    return this;
  }

  assignStyle(fill: Fill, stroke: Stroke) {
    this.stroke = stroke?.clone();
    this.fill = fill?.clone();
    return this;
  }

  copyStyle(item: Geometry) {
    if (item instanceof Group && item.items.length > 0) {
      this.copyStyle(item.items[0]);
    } else if (item instanceof Path || item instanceof Shape) {
      this.stroke = item.stroke?.clone();
      this.fill = item.fill?.clone();
    }
    return this;
  }

  scaleStroke(scaleFactor: number) {
    if (this.stroke && !this.stroke.hairline) {
      this.stroke.width *= scaleFactor;
    }
    return this;
  }

  toSVGString(options: ExportOptions) {
    return pathOrShapeToSVGString(this, options);
  }
  toSVGPathString(options?: ExportOptions) {
    return this.paths.map((path) => path.toSVGPathString(options)).join("");
  }
  paintToCanvas(ctx: CanvasRenderingContext2D, options?: ExportOptions) {
    paintToCanvas(this, ctx, options);
  }

  looseBoundingBox() {
    const { paths } = this;
    let box: BoundingBox | undefined;
    for (let path of paths) {
      const pathBox = path.looseBoundingBox();
      if (box) {
        if (pathBox) {
          box.expandToIncludeBoundingBox(pathBox);
        }
      } else {
        box = pathBox;
      }
    }
    return box;
  }

  tightBoundingBox(): BoundingBox {
    return computeTightBoundingBox(this);
  }

  isContainedByBoundingBox(box: BoundingBox) {
    return box.containsBoundingBox(this.tightBoundingBox());
  }

  isIntersectedByBoundingBox(box: BoundingBox) {
    return this.paths.some((path) => path.isIntersectedByBoundingBox(box));
  }

  isOverlappedByBoundingBox(box: BoundingBox) {
    return this.paths.some((path) => path.isOverlappedByBoundingBox(box));
  }

  closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
    const { paths } = this;
    let closestResult = { distance: Infinity };
    if (paths.length === 0) return closestResult;

    for (let path of paths) {
      const result = path.closestPointWithinDistanceToPoint(maxDistance, point);
      if (result.distance < closestResult.distance) {
        closestResult = result;
      }
    }

    return closestResult;
  }

  /**
   * Creates a path of this shape on an HTML Canvas 2D context but does not fill
   * or stroke it. Note: this does not call ctx.beginPath().
   */
  toCanvasPath(ctx: CanvasRenderingContext2D) {
    for (let path of this.paths) {
      path.toCanvasPath(ctx);
    }
  }

  containsPoint(point: Vec) {
    dummyCanvasCtx.beginPath();
    this.toCanvasPath(dummyCanvasCtx);
    return dummyCanvasCtx.isPointInPath(point.x, point.y, "evenodd");
  }

  styleContainsPoint(point: Vec) {
    return styleContainsPoint(this, point);
  }

  reverse() {
    this.paths.forEach((path) => path.reverse());
    this.paths.reverse();
    return this;
  }

  static isValid = (a: unknown): a is Shape => {
    return a instanceof Shape && a.isValid();
  };

  static fromSVGPathString = (svgPathString: string) => {
    const pkPath = pkPathFromSVGPathString(svgPathString);
    return fromPkPath(pkPath, true);
  };

  static fromOpenTypePath = (openTypePath: opentype.Path) => {
    const pkCommands = openTypePath.commands.map((command) => {
      if (command.type === "M") {
        return [PathKit.MOVE_VERB, command.x, command.y];
      }
      if (command.type === "L") {
        return [PathKit.LINE_VERB, command.x, command.y];
      }
      if (command.type === "C") {
        return [
          PathKit.CUBIC_VERB,
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          command.x,
          command.y,
        ];
      }
      if (command.type === "Q") {
        return [PathKit.QUAD_VERB, command.x1, command.y1, command.x, command.y];
      }
      // type === "Z"
      return [PathKit.CLOSE_VERB];
    });
    return fromPkCommands(pkCommands);
  };

  static booleanUnion = (items: Geometry[], fillRule?: "evenodd" | "winding") => {
    const unionItems = items.flatMap((item) => item.allShapesAndOrphanedPaths());
    const fillType = fillRule === "winding" ? PathKit.FillType.WINDING : PathKit.FillType.EVENODD;
    let resultPkPath = emptyPkPath();
    for (let item of unionItems) {
      const pkPath = toPkPath(item, fillType);
      resultPkPath.op(pkPath, PathKit.PathOp.UNION);
      deletePkPath(pkPath);
    }
    return fromPkPath(resultPkPath, true);
  };

  static booleanIntersect(items: Geometry[]) {
    const pkPaths = preUnion(items);
    let resultPkPath: any = null; // TODO: Types for PathKit
    for (let pkPath of pkPaths) {
      if (resultPkPath === null) {
        resultPkPath = pkPath;
      } else {
        resultPkPath.op(pkPath, PathKit.PathOp.INTERSECT);
        deletePkPath(pkPath);
      }
    }
    if (resultPkPath === null) return new Shape();
    return fromPkPath(resultPkPath, true);
  }

  static booleanDifference(items: Geometry[]) {
    const pkPaths = preUnion(items);
    let resultPkPath: any = null; // TODO: Types for PathKit
    for (let pkPath of pkPaths) {
      if (resultPkPath === null) {
        resultPkPath = pkPath;
      } else {
        resultPkPath.op(pkPath, PathKit.PathOp.DIFFERENCE);
        deletePkPath(pkPath);
      }
    }
    if (resultPkPath === null) return new Shape();
    return fromPkPath(resultPkPath, true);
  }

  static stroke(item: Geometry, opts: StrokeOptions = {}) {
    let { width, miterLimit, join, cap } = opts;
    if (width === undefined) width = 1;
    if (cap === undefined) cap = "butt";
    if (join === undefined) join = "miter";
    if (miterLimit === undefined) miterLimit = 4;

    const pkPath = toPkPath(item);
    performStroke(pkPath, width, cap, join, miterLimit);

    return fromPkPath(pkPath, true);
  }
}

export interface StrokeOptions {
  width?: number;
  cap?: "butt" | "round" | "square";
  join?: "miter" | "round" | "bevel";
  miterLimit?: number;
}

const preUnion = (items: Geometry[]) => {
  return items.map((item) => {
    if (item instanceof Group) {
      let resultPkPath = emptyPkPath();
      for (let groupItem of item.items) {
        const pkPath = toPkPath(groupItem);
        resultPkPath.op(pkPath, PathKit.PathOp.UNION);
        deletePkPath(pkPath);
      }
      return resultPkPath;
    } else {
      return toPkPath(item);
    }
  });
};
