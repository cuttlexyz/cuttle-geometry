import { Anchor } from "./anchor";
import { BoundingBox } from "./bounding-box";
import { dummyCanvasCtx, paintToCanvas, styleContainsPoint } from "./canvas";
import { ClosestPointResult, ExportOptions, Geometry } from "./geometry";
import { Group } from "./group";
import { clamp, tan } from "./math";
import { AffineMatrix } from "./matrix";
import { computeTightBoundingBox } from "./pathkit";
import {
  bezierFromSegment,
  cubicFromSegment,
  cubicsBySplittingCubicAtTime,
  distanceBetweenBezierPoints,
  isSegmentLinear,
  lineFromSegment,
  partialSegmentLength,
  partitionedPathIntersections,
  pointOnCubicAtTime,
  positionAndTimeAtClosestPointOnCubic,
  positionAndTimeAtClosestPointOnLine,
  Segment,
  segmentLength,
  vecFromBezierPoint,
} from "./segment";
import { Shape } from "./shape";
import { Fill, Stroke } from "./style";
import { pathOrShapeToSVGString } from "./svg";
import { pairs, rotateArray } from "./util";
import { Vec } from "./vec";

export class Path extends Geometry {
  static displayName = "Path";

  anchors: Anchor[];
  closed: boolean;

  stroke?: Stroke;
  fill?: Fill;

  constructor(anchors: Anchor[] = [], closed = false, stroke?: Stroke, fill?: Fill) {
    super();
    this.anchors = anchors;
    this.closed = closed;
    this.stroke = stroke;
    this.fill = fill;
  }

  clone() {
    return new Path(
      this.anchors.map((anchor) => anchor.clone()),
      this.closed,
      this.stroke?.clone(),
      this.fill?.clone()
    );
  }

  isValid() {
    return (
      Array.isArray(this.anchors) &&
      this.anchors.every(Anchor.isValid) &&
      (this.stroke === undefined || Stroke.isValid(this.stroke)) &&
      (this.fill === undefined || Fill.isValid(this.fill))
    );
  }

  affineTransform(affineMatrix: AffineMatrix) {
    for (let anchor of this.anchors) anchor.affineTransform(affineMatrix);
    return this;
  }

  affineTransformWithoutTranslation(affineMatrix: AffineMatrix) {
    for (let anchor of this.anchors) anchor.affineTransformWithoutTranslation(affineMatrix);
    return this;
  }

  allPaths() {
    return [this];
  }

  allAnchors() {
    return [...this.anchors];
  }

  allShapesAndOrphanedPaths() {
    return [this];
  }

  allIntersectables() {
    return [this];
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

  firstAnchor() {
    return this.anchors[0];
  }
  lastAnchor() {
    return this.anchors[this.anchors.length - 1];
  }

  segmentAtIndex(index: number) {
    return new Path(this.anchors.slice(index, index + 2));
  }
  segments() {
    return pairs(this.anchors, this.closed).map((anchors) => new Path(anchors));
  }

  edges() {
    const { anchors } = this;
    const anchorCount = anchors.length;
    if (anchorCount < 2) return [];

    let startIndex = 0;

    // Find the first sharp corner if this is a closed path
    if (this.closed) {
      while (startIndex < anchorCount && anchors[startIndex].hasTangentHandles()) {
        ++startIndex;
      }

      // If we havent found any sharp corners then return the entire path as a single edge
      if (startIndex === anchorCount) {
        return [new Path(anchors, true)];
      }
    }

    const edgePaths: Path[] = [];
    let edgeAnchors: Anchor[] = [];

    // Accumulate anchors from the first corner
    for (let i = startIndex; i < anchorCount; ++i) {
      const anchor = anchors[i];
      edgeAnchors.push(anchor);
      if (edgeAnchors.length >= 2 && !anchor.hasTangentHandles()) {
        edgePaths.push(new Path(edgeAnchors));
        edgeAnchors = [anchor];
      }
    }

    // Accumulate any remaining anchors
    if (startIndex > 0) {
      for (let i = 0, n = startIndex + 1; i < n; ++i) {
        const anchor = anchors[i];
        edgeAnchors.push(anchor);
        if (edgeAnchors.length >= 2 && !anchor.hasTangentHandles()) {
          edgePaths.push(new Path(edgeAnchors));
          edgeAnchors = [anchor];
        }
      }
    } else if (this.closed) {
      edgeAnchors.push(anchors[0]);
    }

    // Append the final edge path
    if (edgeAnchors.length > 1) {
      edgePaths.push(new Path(edgeAnchors));
    }

    return edgePaths;
  }

  toSVGString(options: ExportOptions) {
    return pathOrShapeToSVGString(this, options);
  }
  toSVGPathString(options?: ExportOptions) {
    const toString = (x: number) => {
      if (options?.maxPrecision !== undefined) {
        return x.toFixed(options.maxPrecision);
      }
      return x.toString();
    };
    const SVGStringCommandForSegment = (a1: Anchor, a2: Anchor): string => {
      if (a1.handleOut.x != 0 || a1.handleOut.y != 0 || a2.handleIn.x != 0 || a2.handleIn.y != 0) {
        const x1 = toString(a1.position.x + a1.handleOut.x);
        const y1 = toString(a1.position.y + a1.handleOut.y);
        const x2 = toString(a2.position.x + a2.handleIn.x);
        const y2 = toString(a2.position.y + a2.handleIn.y);
        const x3 = toString(a2.position.x);
        const y3 = toString(a2.position.y);
        return `C${x1} ${y1} ${x2} ${y2} ${x3} ${y3} `;
      } else {
        const x = toString(a2.position.x);
        const y = toString(a2.position.y);
        return `L${x} ${y} `;
      }
    };

    if (this.anchors.length > 1) {
      const cmds: string[] = [];
      let a1 = this.anchors[0];
      const x = toString(a1.position.x);
      const y = toString(a1.position.y);
      cmds.push(`M${x} ${y} `);
      for (let i = 1, n = this.anchors.length; i < n; ++i) {
        let a2 = this.anchors[i];
        cmds.push(SVGStringCommandForSegment(a1, a2));
        a1 = a2;
      }
      if (this.closed) {
        cmds.push(SVGStringCommandForSegment(a1, this.anchors[0]));
        cmds.push("Z ");
      }
      return cmds.join("");
    }
    return " ";
  }
  paintToCanvas(ctx: CanvasRenderingContext2D, options?: ExportOptions) {
    paintToCanvas(this, ctx, options);
  }

  /**
   * Creates a path on an HTML Canvas 2D context but does not fill or stroke it.
   * Note: this does not call ctx.beginPath().
   */
  toCanvasPath(ctx: CanvasRenderingContext2D) {
    if (this.anchors.length > 1) {
      let a1 = this.anchors[0];
      ctx.moveTo(a1.position.x, a1.position.y);
      for (let i = 1, n = this.anchors.length; i < n; ++i) {
        let a2 = this.anchors[i];
        toCanvasForSegment(ctx, a1, a2);
        a1 = a2;
      }
      if (this.closed) {
        toCanvasForSegment(ctx, a1, this.anchors[0]);
        ctx.closePath();
      }
    }
  }

  looseBoundingBox() {
    const { anchors, closed } = this;

    if (anchors.length === 0) return undefined;
    if (anchors.length === 1) return anchors[0].looseBoundingBox();

    const scratchPos = new Vec();

    let anchor = anchors[0];
    const box = new BoundingBox(anchor.position.clone(), anchor.position.clone());
    box.expandToIncludePoint(anchor.position.clone().add(anchor.handleOut));
    if (closed) {
      box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleIn));
    }

    const n1 = anchors.length - 1;
    for (let i = 1; i < n1; ++i) {
      anchor = anchors[i];
      box.expandToIncludePoint(anchor.position);
      box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleIn));
      box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleOut));
    }

    anchor = anchors[n1];
    box.expandToIncludePoint(anchor.position);
    box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleIn));
    if (closed) {
      box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleOut));
    }

    return box;
  }

  tightBoundingBox(): BoundingBox {
    if (this.anchors.length === 1) {
      return this.anchors[0].tightBoundingBox();
    }
    return computeTightBoundingBox(this);
  }

  isContainedByBoundingBox(box: BoundingBox) {
    return box.containsBoundingBox(this.tightBoundingBox());
  }

  isIntersectedByBoundingBox(box: BoundingBox) {
    const looseBounds = this.looseBoundingBox();
    if (looseBounds?.overlapsBoundingBox(box)) {
      const intersections = partitionedPathIntersections([this], [Path.fromBoundingBox(box)]);
      return intersections.length > 0;
    }
    return false;
  }

  isOverlappedByBoundingBox(box: BoundingBox) {
    return this.isContainedByBoundingBox(box) || this.isIntersectedByBoundingBox(box);
  }

  containsPoint(point: Vec) {
    if (!this.closed) return false;
    dummyCanvasCtx.beginPath();
    this.toCanvasPath(dummyCanvasCtx);
    return dummyCanvasCtx.isPointInPath(point.x, point.y, "evenodd");
  }

  styleContainsPoint(point: Vec) {
    return styleContainsPoint(this, point);
  }

  reverse() {
    for (let anchor of this.anchors) {
      anchor.reverse();
    }
    this.anchors.reverse();
    return this;
  }

  length() {
    let length = 0;
    for (let segment of pairs(this.anchors, this.closed)) {
      length += segmentLength(segment);
    }
    return length;
  }

  timeAtDistance(distance: number) {
    const { anchors, closed } = this;

    const bezierLUTCount = 100;
    const bezierLUTSegmentDuration = 1 / (bezierLUTCount - 1);

    let t = 0;
    let length = 0;
    for (let segment of pairs(anchors, closed)) {
      if (isSegmentLinear(segment)) {
        const segmentLength = segment[0].position.distance(segment[1].position);
        if (length + segmentLength > distance) {
          return t + (distance - length) / segmentLength;
        }
        length += segmentLength;
      } else {
        const bezier = bezierFromSegment(segment);
        const segmentLength = bezier.length();
        if (length + segmentLength > distance) {
          const points = bezier.getLUT(bezierLUTCount);
          for (let i = 1, n = points.length; i < n; ++i) {
            const segLength = distanceBetweenBezierPoints(points[i - 1], points[i]);
            if (length + segLength > distance) {
              return t + ((distance - length) / segLength) * bezierLUTSegmentDuration;
            }
            t += bezierLUTSegmentDuration;
            length += segLength;
          }
          return t;
        }
        length += segmentLength;
      }
      t += 1;
    }

    return closed ? anchors.length : anchors.length - 1;
  }

  distanceAtTime(time: number) {
    if (time <= 0) return 0;

    const { anchors, closed } = this;
    if (time >= (closed ? anchors.length : anchors.length - 1)) return this.length();

    const segmentIndex = time | 0;

    let distance = 0;
    for (let i = 0; i < segmentIndex; ++i) {
      const nextIndex = closed ? (i + 1) % anchors.length : i + 1;
      distance += segmentLength([anchors[i], anchors[nextIndex]]);
    }

    const segmentTime = time - segmentIndex;
    if (segmentTime > 0) {
      const nextIndex = closed ? (segmentIndex + 1) % anchors.length : segmentIndex + 1;
      const segment: Segment = [anchors[segmentIndex], anchors[nextIndex]];
      distance += partialSegmentLength(segment, segmentTime);
    }

    return distance;
  }

  positionAtTime(time: number) {
    const { anchors, closed } = this;
    if (anchors.length === 0) return new Vec(); // TODO (ryan): Maybe return null here?
    if (anchors.length < 2) return anchors[0].position.clone();

    time = normalizeTimeForPath(time, this);
    const anchorIndex = time | 0;
    const anchor = anchors[anchorIndex];

    if (time === anchorIndex) {
      // Time is an integer
      return anchor.position.clone();
    }

    let nextAnchorIndex = anchorIndex + 1;
    if (closed) nextAnchorIndex %= anchors.length;
    const nextAnchor = anchors[nextAnchorIndex];

    const segment: Segment = [anchor, nextAnchor];
    const segmentTime = time - anchorIndex;
    if (isSegmentLinear(segment)) {
      return anchor.position.clone().mix(nextAnchor.position, segmentTime);
    } else {
      const cubic = cubicFromSegment(segment);
      return pointOnCubicAtTime(new Vec(), cubic, segmentTime);
    }
  }

  derivativeAtTime(time: number) {
    const { anchors, closed } = this;
    if (anchors.length < 2) return new Vec(); // Tangent of a point is zero?

    time = normalizeTimeForPath(time, this);
    const anchorIndex = time | 0;
    const anchor = anchors[anchorIndex];

    if (time === anchorIndex) {
      // Time is an integer
      if (!closed && anchorIndex === anchors.length - 1) {
        if (anchor.handleIn.isZero()) {
          const prevAnchor = anchors[anchorIndex - 1];
          return prevAnchor.position
            .clone()
            .add(prevAnchor.handleOut)
            .sub(anchor.position)
            .negate()
            .normalize();
        }
        return anchor.handleIn.clone().negate().normalize();
      }
      if (anchor.handleOut.isZero()) {
        const nextAnchor = anchors[anchorIndex + 1];
        return nextAnchor.position
          .clone()
          .add(nextAnchor.handleIn)
          .sub(anchor.position)
          .normalize();
      }
      return anchor.handleOut.clone().normalize();
    }

    let nextAnchorIndex = anchorIndex + 1;
    if (closed) nextAnchorIndex %= anchors.length;
    const nextAnchor = anchors[nextAnchorIndex];

    const segment: Segment = [anchor, nextAnchor];
    if (isSegmentLinear(segment)) {
      return nextAnchor.position.clone().sub(anchor.position).normalize();
    } else {
      const segmentTime = time - anchorIndex;
      const curve = bezierFromSegment(segment);
      return vecFromBezierPoint(curve.derivative(segmentTime));
    }
  }

  tangentAtTime(time: number) {
    return this.derivativeAtTime(time).normalize();
  }

  normalAtTime(time: number) {
    return this.tangentAtTime(time).rotate90();
  }

  insertAnchorAtTime(time: number) {
    const { anchors, closed } = this;

    if (anchors.length < 2) return undefined;

    time = normalizeTimeForPath(time, this);

    let anchorIndex1 = time | 0;
    if (time === anchorIndex1) {
      return anchors[anchorIndex1 % anchors.length]; // Inserting an anchor where one already exists does nothing
    }

    const segmentTime = time - anchorIndex1;
    let anchorIndex2 = anchorIndex1 + 1;
    if (closed) {
      anchorIndex1 %= anchors.length;
      anchorIndex2 %= anchors.length;
    }

    const segment: Segment = [anchors[anchorIndex1], anchors[anchorIndex2]];

    let anchor = new Anchor();

    if (isSegmentLinear(segment)) {
      // Segment is a straight line so we can linearly interpolate
      anchor.position.copy(segment[0].position).mix(segment[1].position, segmentTime);
    } else {
      const cubic = cubicFromSegment(segment);
      const [left, right] = cubicsBySplittingCubicAtTime(cubic, segmentTime);

      segment[0].handleOut.copy(left[1]).sub(segment[0].position);
      segment[1].handleIn.copy(right[2]).sub(segment[1].position);

      anchor.position.copy(right[0]);
      anchor.handleIn.copy(left[2]).sub(right[0]);
      anchor.handleOut.copy(right[1]).sub(right[0]);
    }

    anchors.splice(anchorIndex1 + 1, 0, anchor);

    return anchor;
  }

  splitAtAnchor(anchor: Anchor) {
    const { anchors, closed } = this;

    const anchorIndex = anchors.indexOf(anchor);
    if (anchorIndex === -1) return [this];

    if (closed) {
      if (anchorIndex > 0) rotateArray(anchors, anchorIndex);
      anchors.push(anchors[0].clone());
      this.closed = false;
      return [this];
    } else {
      const path1 = new Path(anchors.slice(0, anchorIndex));
      const path2 = new Path(anchors.slice(anchorIndex));
      path1.anchors.push(path2.anchors[0].clone()); // Append a copy of the shared anchor
      return [path1, path2];
    }
  }

  splitAtTime(time: number) {
    const anchor = this.insertAnchorAtTime(time);
    if (anchor) {
      return this.splitAtAnchor(anchor);
    }
    return [this];
  }

  roundCornerInfoAtAnchor(anchor: Anchor, radius: number) {
    if (radius <= 0) return null;
    const { anchors, closed } = this;
    const anchorIndex = anchors.indexOf(anchor);
    if (anchorIndex === -1) return null;
    if (anchorIndex === 0 && !closed) return null;
    if (anchorIndex === anchors.length - 1 && !closed) return null;

    const centerAtTime = (time: number, sign: number) => {
      return this.positionAtTime(time).add(this.normalAtTime(time).mulScalar(sign * radius));
    };

    const numSteps = 100;
    const step = 1 / numSteps;

    const time = anchorIndex;
    for (let sign of [-1, 1]) {
      let aPoints: Vec[] = [];
      for (let i = 1; i < numSteps; i++) {
        const a = centerAtTime(time - i * step, sign);
        aPoints[i] = a;
      }
      let prevB: Vec | null = null;
      for (let j = 1; j < numSteps; j++) {
        const b = centerAtTime(time + j * step, sign);
        if (prevB) {
          for (let i = 2; i < numSteps; i++) {
            const a = aPoints[i];
            const prevA = aPoints[i - 1];
            const center = segmentSegmentIntersection(prevA, a, prevB, b);
            if (center) {
              // TODO: Interpolate between previous and current step.

              const time1 = time - (i - 1) * step;
              const time2 = time + (j - 1) * step;
              const point1 = this.positionAtTime(time1);
              const point2 = this.positionAtTime(time2);
              let startAngle = point1.clone().sub(center).angle();
              let endAngle = point2.clone().sub(center).angle();

              if (sign === 1) {
                // We're on the right-hand side of the path, so we round the
                // corner clockwise, so startAngle must be less than endAngle.
                if (startAngle > endAngle) endAngle += 360;
              } else {
                // We're on the left-hand side of the path, so we round the
                // corner counter-clockwise, so startAngle must be greater than
                // endAngle.
                if (startAngle < endAngle) startAngle += 360;
              }

              return {
                center,
                time1,
                time2,
                point1,
                point2,
                sign,
                startAngle,
                endAngle,
              };
            }
          }
        }
        prevB = b;
      }
    }
    return null;
  }

  roundCornerAtAnchor(anchor: Anchor, radius: number) {
    const info = this.roundCornerInfoAtAnchor(anchor, radius);
    if (!info) return this;

    let { center, time1, time2, startAngle, endAngle } = info;
    time1 = normalizeTimeForPath(time1, this);
    time2 = normalizeTimeForPath(time2, this);

    let anchor1: Anchor | undefined;
    let anchor2: Anchor | undefined;
    if (time1 > time2) {
      anchor1 = this.insertAnchorAtTime(time1);
      anchor2 = this.insertAnchorAtTime(time2);
    } else {
      anchor2 = this.insertAnchorAtTime(time2);
      anchor1 = this.insertAnchorAtTime(time1);
    }

    if (anchor1 && anchor2) {
      const arc = Path.fromArc(center, radius, startAngle, endAngle);
      anchor1.handleOut = arc.anchors[0].handleOut;
      anchor2.handleIn = arc.anchors[arc.anchors.length - 1].handleIn;
      const anchor1Index = this.anchors.indexOf(anchor1);
      const anchor2Index = this.anchors.indexOf(anchor2);
      this.anchors.splice(anchor2Index - 1, 1, ...arc.anchors.slice(1, arc.anchors.length - 1));
    }

    return this;
  }

  /**
   * Makes the path a polyline (that is, a path with only straight segments)
   * such that each segment is less than `maxSegmentLength`.
   *
   * @remarks
   * Calling this will replace `this.anchors`.
   *
   * @param maxSegmentLength maximum length of the new segments
   * @chainable
   */
  polygonize(maxSegmentLength: number) {
    if (maxSegmentLength <= 0) return this;
    const newAnchors: Anchor[] = [];
    const segments = this.segments();
    for (let segment of segments) {
      const length = segment.length();
      const divisions = Math.ceil(length / maxSegmentLength);
      const step = length / divisions;
      for (let i = 0; i < divisions; i++) {
        const distance = i * step;
        const time = segment.timeAtDistance(distance);
        const point = segment.positionAtTime(time);
        newAnchors.push(new Anchor(point));
      }
    }
    this.anchors = newAnchors;
    return this;
  }

  closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
    const closestResult: ClosestPointResult = { distance: Infinity };
    const { anchors, closed } = this;

    if (anchors.length === 0) return closestResult;
    if (anchors.length === 1)
      return anchors[0].closestPointWithinDistanceToPoint(maxDistance, point);

    const maxDistanceSq = maxDistance * maxDistance;

    let segmentIndex = 0;
    for (let segment of pairs(anchors, closed)) {
      if (isSegmentLinear(segment)) {
        const line = lineFromSegment(segment);
        const bounds = BoundingBox.fromPoints(line)!.expandScalar(maxDistance);
        if (bounds.containsPoint(point)) {
          // TODO (ryan): There is probably a more triggy way to directly compute
          // distance here and potentially skip computing the position
          const { position, time } = positionAndTimeAtClosestPointOnLine(point, line);
          const distanceSq = position.distanceSquared(point);
          if (
            distanceSq < maxDistanceSq &&
            distanceSq < closestResult.distance * closestResult.distance
          ) {
            closestResult.position = position;
            closestResult.distance = Math.sqrt(distanceSq);
            closestResult.time = segmentIndex + time;
          }
        }
      } else {
        const cubic = cubicFromSegment(segment);
        const bounds = BoundingBox.fromCubic(cubic).expandScalar(maxDistance);
        if (bounds.containsPoint(point)) {
          const { position, time } = positionAndTimeAtClosestPointOnCubic(point, cubic);
          const distanceSq = position.distanceSquared(point);
          if (
            distanceSq < maxDistanceSq &&
            distanceSq < closestResult.distance * closestResult.distance
          ) {
            closestResult.position = position;
            closestResult.distance = Math.sqrt(distanceSq);
            closestResult.time = segmentIndex + time;
          }
        }
      }
      ++segmentIndex;
    }

    return closestResult;
  }

  static isValid(a: unknown): a is Path {
    return a instanceof Path && a.isValid();
  }

  static fromPoints(points: Vec[], closed = false) {
    return new Path(
      points.map((point) => new Anchor(point)),
      closed
    );
  }

  static fromCubicBezierPoints(points: Vec[], closed = false) {
    let prevAnchor = new Anchor(points[0]);
    const path = new Path([prevAnchor], closed);
    for (let i = 1, n = points.length; i < n; ) {
      prevAnchor.handleOut.copy(points[i]).sub(prevAnchor.position);
      if (++i === n) break;
      const nextHandleIn = points[i].clone();
      if (++i === n) {
        if (closed) {
          path.anchors[0].handleIn.copy(nextHandleIn).sub(path.anchors[0].position);
        } else {
          path.anchors.push(new Anchor(nextHandleIn));
        }
        break;
      }
      const nextAnchor = new Anchor(points[i], nextHandleIn);
      nextAnchor.handleIn.sub(nextAnchor.position);
      path.anchors.push(nextAnchor);
      prevAnchor = nextAnchor;
      ++i;
    }
    return path;
  }

  static fromBoundingBox(box: BoundingBox) {
    const { min, max } = box;
    return new Path(
      [
        new Anchor(new Vec(min.x, min.y)),
        new Anchor(new Vec(max.x, min.y)),
        new Anchor(new Vec(max.x, max.y)),
        new Anchor(new Vec(min.x, max.y)),
      ],
      true
    );
  }

  static fromArc(center: Vec, radius: number, startAngle: number, endAngle: number) {
    const absAngle = Math.abs(startAngle - endAngle);
    const numSegments = Math.ceil(absAngle / 90);
    const segmentAngle = (endAngle - startAngle) / numSegments;

    // Built up path from segments.
    const path = new Path([new Anchor(new Vec(1, 0))]);
    for (let i = 0; i < numSegments; i++) {
      const segment = arcSegment(segmentAngle);
      segment.transform({ rotation: i * segmentAngle });
      const lastAnchor = path.anchors[path.anchors.length - 1];
      lastAnchor.handleOut = segment.anchors[0].handleOut;
      path.anchors.push(segment.anchors[1]);
    }

    path.transform({
      position: center,
      rotation: startAngle,
      scale: radius,
    });

    return path;
  }
}

const normalizeTimeForPath = (time: number, path: Path) => {
  const len = path.anchors.length;
  if (path.closed) {
    // Loop time.
    if (time >= 0) {
      return time % len;
    } else {
      return (time + len) % len;
    }
  }
  return clamp(time, 0, len - 1);
};

/**
 * TODO: Remove this in favor of lineLineIntersection next time we revisit round
 * corners.
 *
 * Returns the intersection point of line segments p1-p2 and p3-p4. If the line
 * segments do not intersect, or are coincident, returns null. Based on
 * http://www-cs.ccny.cuny.edu/~wolberg/capstone/intersection/Intersection%20point%20of%20two%20lines.html
 */
const segmentSegmentIntersection = (p1: Vec, p2: Vec, p3: Vec, p4: Vec) => {
  // TODO: Merge with intersectionBetweenLineSegments
  // TODO: Does this always find it if e.g. p1 === p3?
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denom === 0) return null;
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  if (ua < 0 || ua > 1) return null;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
  if (ub < 0 || ub > 1) return null;
  return new Vec(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
};

const toCanvasForSegment = (ctx: CanvasRenderingContext2D, a1: Anchor, a2: Anchor) => {
  if (a1.handleOut.x != 0 || a1.handleOut.y != 0 || a2.handleIn.x != 0 || a2.handleIn.y != 0) {
    ctx.bezierCurveTo(
      a1.position.x + a1.handleOut.x,
      a1.position.y + a1.handleOut.y,
      a2.position.x + a2.handleIn.x,
      a2.position.y + a2.handleIn.y,
      a2.position.x,
      a2.position.y
    );
  } else {
    ctx.lineTo(a2.position.x, a2.position.y);
  }
};

const arcSegment = (angle: number) => {
  // based on https://pomax.github.io/bezierinfo/#circles_cubic
  const f = (4 / 3) * tan(angle / 4);
  return new Path([
    new Anchor(new Vec(1, 0), new Vec(0, 0), new Vec(0, f)),
    new Anchor(new Vec(1, 0).rotate(angle), new Vec(0, -f).rotate(angle), new Vec(0, 0)),
  ]);
};
