import { BoundingBox } from "./bounding-box";
import { Color } from "./color";
import { DEFAULT_TOLERANCE } from "./constants";
import { Geometry } from "./geometry";
import { AffineMatrix } from "./matrix";
import { Path } from "./path";
import { copyPkPath, deletePkPath, fromPkPath, PathKit, performStroke, toPkPath } from "./pathkit";
import { Shape } from "./shape";
import { Fill, Stroke } from "./style";
import { ClosestPointResult, ExportOptions } from "./util";
import { Vec } from "./vec";

export class Group extends Geometry {
  items: Geometry[];

  constructor(items: Geometry[] = []) {
    super();
    this.items = items;
  }

  clone() {
    return new Group(this.items.map((item) => item.clone()));
  }

  isValid() {
    return Array.isArray(this.items) && this.items.every(Geometry.isValid);
  }

  affineTransform(affineMatrix: AffineMatrix) {
    for (let item of this.items) item.affineTransform(affineMatrix);
    return this;
  }

  affineTransformWithoutTranslation(affineMatrix: AffineMatrix) {
    for (let item of this.items) item.affineTransformWithoutTranslation(affineMatrix);
    return this;
  }

  allShapes() {
    return this.items.flatMap((item) => item.allShapes());
  }

  allPaths() {
    return this.items.flatMap((item) => item.allPaths());
  }

  allAnchors() {
    return this.items.flatMap((item) => item.allAnchors());
  }

  allOrphanedAnchors() {
    return this.items.flatMap((item) => item.allOrphanedAnchors());
  }

  allShapesAndOrphanedPaths() {
    return this.items.flatMap((item) => item.allShapesAndOrphanedPaths());
  }

  allIntersectables() {
    return this.items.flatMap((item) => item.allIntersectables());
  }

  assignFill(fill: Fill) {
    for (let item of this.items) item.assignFill(fill);
    return this;
  }
  removeFill() {
    for (let item of this.items) item.removeFill();
    return this;
  }

  assignStroke(stroke: Stroke) {
    for (let item of this.items) item.assignStroke(stroke);
    return this;
  }
  removeStroke() {
    for (let item of this.items) item.removeStroke();
    return this;
  }

  assignStyle(fill: Fill, stroke: Stroke) {
    for (let item of this.items) item.assignStyle(fill, stroke);
    return this;
  }

  copyStyle(itemToCopy: Geometry) {
    for (let item of this.items) item.copyStyle(itemToCopy);
    return this;
  }

  scaleStroke(scaleFactor: number) {
    for (let item of this.items) item.scaleStroke(scaleFactor);
    return this;
  }

  toSVGString(options: ExportOptions) {
    const childrenString = this.items.map((item) => item.toSVGString(options)).join("\n");
    return `<g>\n${indentString(childrenString)}\n</g>`;
  }
  toSVGPathString(options?: ExportOptions) {
    return this.items.map((path) => path.toSVGPathString(options)).join("");
  }
  paintToCanvas(ctx: CanvasRenderingContext2D, options?: ExportOptions) {
    for (let item of this.items) {
      item.paintToCanvas(ctx, options);
    }
  }

  looseBoundingBox() {
    const { items } = this;
    if (items.length === 0) return undefined;

    let box: BoundingBox | undefined;
    for (let item of items) {
      const itemBox = item.looseBoundingBox();
      if (itemBox) {
        if (box === undefined) box = itemBox;
        else box.expandToIncludeBoundingBox(itemBox);
      }
    }
    return box;
  }

  tightBoundingBox() {
    const { items } = this;
    if (items.length === 0) return undefined;

    let box: BoundingBox | undefined;
    for (let item of items) {
      const itemBox = item.tightBoundingBox();
      if (itemBox) {
        if (box === undefined) box = itemBox;
        else box.expandToIncludeBoundingBox(itemBox);
      }
    }
    return box;
  }

  isContainedByBoundingBox(box: BoundingBox) {
    if (this.items.length === 0) return false; // Array.every() returns true on an empty array so we need a special case.
    return this.items.every((item) => item.isContainedByBoundingBox(box));
  }

  isIntersectedByBoundingBox(box: BoundingBox) {
    return this.items.some((item) => item.isIntersectedByBoundingBox(box));
  }

  isOverlappedByBoundingBox(box: BoundingBox) {
    return this.items.some((item) => item.isOverlappedByBoundingBox(box));
  }

  closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
    const { items } = this;
    let closestResult = { distance: Infinity };
    if (items.length === 0) return closestResult;

    for (let item of items) {
      const result = item.closestPointWithinDistanceToPoint(maxDistance, point);
      if (result.distance < closestResult.distance) {
        closestResult = result;
      }
    }

    return closestResult;
  }

  containsPoint(point: Vec) {
    return this.items.some((item) => item.containsPoint(point));
  }

  styleContainsPoint(point: Vec) {
    return this.items.some((item) => item.styleContainsPoint(point));
  }

  reverse() {
    this.items.forEach((item) => item.reverse());
    this.items.reverse();
    return this;
  }

  static isValid(a: unknown): a is Group {
    return a instanceof Group && a.isValid();
  }

  static flatten(geometry: Geometry, backgroundColor?: Color) {
    const colorPkPaths: { color: Color; pkPath: any }[] = [];
    const addPkPath = (pkPath2: any, color2: Color) => {
      let found = false;
      for (let { color, pkPath } of colorPkPaths) {
        if (color.equals(color2)) {
          found = true;
          pkPath.op(pkPath2, PathKit.PathOp.UNION);
        } else {
          pkPath.op(pkPath2, PathKit.PathOp.DIFFERENCE);
        }
      }
      const isBackgroundColor = backgroundColor && color2.equals(backgroundColor);
      if (!found && !isBackgroundColor) {
        colorPkPaths.push({ color: color2, pkPath: pkPath2 });
      } else {
        deletePkPath(pkPath2);
      }
    };

    for (let item of geometry.allShapesAndOrphanedPaths()) {
      if (item.fill) {
        const color = item.fill.color;
        const pkPath = toPkPath(item);
        addPkPath(pkPath, color);
      }
      if (item.stroke && !item.stroke.hairline) {
        const pkPath = toPkPath(item);
        if (item.stroke.alignment === "centered") {
          performStroke(
            pkPath,
            item.stroke.width,
            item.stroke.cap,
            item.stroke.join,
            item.stroke.miterLimit
          );
        } else {
          const width = item.stroke.width * 2;
          const pkPathStroked = copyPkPath(pkPath);
          performStroke(
            pkPathStroked,
            width,
            item.stroke.cap,
            item.stroke.join,
            item.stroke.miterLimit
          );
          if (item.stroke.alignment === "outer") {
            pkPath.op(pkPathStroked, PathKit.PathOp.REVERSE_DIFFERENCE);
          } else if (item.stroke.alignment === "inner") {
            pkPath.op(pkPathStroked, PathKit.PathOp.INTERSECT);
          }
          deletePkPath(pkPathStroked);
        }
        addPkPath(pkPath, item.stroke.color);
      }
    }

    const result: Shape[] = [];
    for (let { color, pkPath } of colorPkPaths) {
      const shape = fromPkPath(pkPath, true);
      shape.fill = new Fill(color.clone());
      result.push(shape);
    }

    return new Group(result);
  }

  static byJoiningPaths(paths: Path[], tolerance = DEFAULT_TOLERANCE) {
    if (paths.length <= 1) return paths;

    const toleranceSq = tolerance * tolerance;

    // Clone because we're mutating the input paths (e.g. reversing anchors).
    let inPaths = paths.map((path) => path.clone());
    let outPaths: Path[] = [];
    while (true) {
      outPaths = [];
      for (let inPath of inPaths) {
        if (inPath.closed) {
          outPaths.push(inPath);
          continue;
        }

        const inStart = inPath.anchors[0];
        const inEnd = inPath.anchors[inPath.anchors.length - 1];

        let i = 0;
        for (let n = outPaths.length; i < n; ++i) {
          const outPath = outPaths[i];
          if (outPath.closed) continue;
          const outStart = outPath.anchors[0];
          const outEnd = outPath.anchors[outPath.anchors.length - 1];
          if (inStart.position.distanceSquared(outEnd.position) <= toleranceSq) {
            outEnd.handleOut.copy(inStart.handleOut);
            outPath.anchors.push(...inPath.anchors.slice(1));
            break;
          } else if (inStart.position.distanceSquared(outStart.position) <= toleranceSq) {
            outStart.handleIn.copy(inStart.handleOut);
            outPath.anchors.splice(0, 0, ...inPath.reverse().anchors.slice(0, -1));
            break;
          } else if (inEnd.position.distanceSquared(outStart.position) <= toleranceSq) {
            outStart.handleIn.copy(inEnd.handleIn);
            outPath.anchors.splice(0, 0, ...inPath.anchors.slice(0, -1));
            break;
          } else if (inEnd.position.distanceSquared(outEnd.position) <= toleranceSq) {
            outEnd.handleOut.copy(inEnd.handleIn);
            outPath.anchors.push(...inPath.reverse().anchors.slice(1));
            break;
          }
        }

        if (i === outPaths.length) {
          // The path was not merged. Append it to outPaths for the next interation.
          outPaths.push(inPath);
        }
      }

      if (outPaths.length === inPaths.length) break;
      inPaths = outPaths;
    }

    // Close any remaining paths that have matching endpoints
    for (let path of outPaths) {
      if (path.anchors.length > 1) {
        const start = path.anchors[0];
        const end = path.anchors[path.anchors.length - 1];
        if (start.position.distanceSquared(end.position) <= toleranceSq) {
          start.handleIn.copy(end.handleIn);
          path.anchors.splice(-1, 1);
          path.closed = true;
        }
      }
    }

    return new Group(outPaths);
  }
}

const indentString = (s: string) => {
  return "  " + s.replace(/\n/g, "\n  ");
};
