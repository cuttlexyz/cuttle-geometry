import { ExportOptions } from "./geometry";
import { Path } from "./path";
import { Shape } from "./shape";
import { Stroke } from "./style";
import { Vec } from "./vec";

// Dummy HTML Canvas context for running isPointInPath and isPointInStroke.
const dummyCanvas = document.createElement("canvas");
export const dummyCanvasCtx = dummyCanvas.getContext("2d") as CanvasRenderingContext2D;

export const styleContainsPoint = (geom: Path | Shape, point: Vec) => {
  const { stroke, fill } = geom;

  const hasVisibleFill = fill && fill.color.a > 0;
  const hasVisibleStroke = stroke && !stroke.hairline && stroke.color.a > 0;

  // Optimization: exit early if there's no fill or stroke.
  if (!hasVisibleFill && !hasVisibleStroke) return false;

  dummyCanvasCtx.beginPath();
  geom.toCanvasPath(dummyCanvasCtx);
  const isInPath = dummyCanvasCtx.isPointInPath(point.x, point.y, "evenodd");

  if (hasVisibleFill && isInPath) return true;

  if (hasVisibleStroke && stroke) {
    // Check stroke again here to appease the type system
    dummyCanvasCtx.lineJoin = stroke.join as CanvasLineJoin;
    dummyCanvasCtx.lineCap = stroke.cap as CanvasLineCap;
    dummyCanvasCtx.miterLimit = stroke.miterLimit;
    if (stroke.alignment === "centered") {
      dummyCanvasCtx.lineWidth = stroke.width;
      return dummyCanvasCtx.isPointInStroke(point.x, point.y);
    } else if (stroke.alignment === "outer") {
      dummyCanvasCtx.lineWidth = stroke.width * 2;
      return !isInPath && dummyCanvasCtx.isPointInStroke(point.x, point.y);
    } else if (stroke.alignment === "inner") {
      dummyCanvasCtx.lineWidth = stroke.width * 2;
      return isInPath && dummyCanvasCtx.isPointInStroke(point.x, point.y);
    }
  }
  return false;
};

export const paintToCanvas = (
  item: Path | Shape,
  ctx: CanvasRenderingContext2D,
  options: ExportOptions = {}
) => {
  ctx.beginPath();
  item.toCanvasPath(ctx);

  let stroke = item.stroke;
  let fill = item.fill;
  if (!stroke && !fill) {
    // If no stroke or fill, use the default stroke.
    stroke = new Stroke();
  }

  if (fill) {
    ctx.fillStyle = fill.color.toCSSString();
    ctx.fill("evenodd");
  }

  if (stroke) {
    ctx.strokeStyle = stroke.color.toCSSString();
    ctx.lineCap = stroke.cap as CanvasLineCap;
    ctx.lineJoin = stroke.join as CanvasLineJoin;
    ctx.miterLimit = stroke.miterLimit;

    const nonStandardAlignment =
      !stroke.hairline && (stroke.alignment === "outer" || stroke.alignment === "inner");
    if (stroke.hairline) {
      ctx.lineWidth = options?.hairlineStrokeWidth ?? 1;
    } else if (nonStandardAlignment) {
      ctx.lineWidth = stroke.width * 2;
    } else {
      ctx.lineWidth = stroke.width;
    }

    if (nonStandardAlignment) {
      ctx.save();
      ctx.clip("evenodd");
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.stroke();
    }
  }
};
