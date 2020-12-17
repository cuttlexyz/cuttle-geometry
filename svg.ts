import { Anchor } from "./anchor";
import { Color } from "./color";
import { ExportOptions, Geometry } from "./geometry";
import { Group } from "./group";
import { clamp } from "./math";
import { AffineMatrix } from "./matrix";
import { Path } from "./path";
import { Shape } from "./shape";
import { Fill, Stroke } from "./style";
import { isValidUnit, scaleFactorForUnitConversion, Unit } from "./units";
import { Vec } from "./vec";

export interface ImportSVGOptions {
  units: Unit;
}

export const geometryFromSVGString = (svgString: string, options: ImportSVGOptions) => {
  const domparser = new DOMParser();
  const doc = domparser.parseFromString(svgString, "image/svg+xml");
  const svgNode = doc.querySelector("svg");
  if (svgNode instanceof SVGElement) {
    return geometryFromSVGNode(svgNode, options) ?? new Group();
  } else {
    return new Group();
  }
};

const tagNamesWithDefaultPaint: { [tagName: string]: boolean } = {
  path: true,
  polygon: true,
  polyline: true,
  circle: true,
  ellipse: true,
  rect: true,
  text: true,
};

/**
 * Takes two anchors and using their positions mutates anchor1's handleOut and
 * anchor2's handleIn so that there's a circular arc going from anchor1 to
 * anchor2. If horiziontal is true, the arc leaves anchor1 going in a horizontal
 * direction. It's vertical otherwise.
 *
 * This might be a useful geometry routine to expose.
 */
const makeCircularArc = (anchor1: Anchor, anchor2: Anchor, horizontal: boolean) => {
  const c = 0.551915024494;
  const x1 = anchor1.position.x;
  const y1 = anchor1.position.y;
  const x2 = anchor2.position.x;
  const y2 = anchor2.position.y;
  if (horizontal) {
    anchor1.handleOut = new Vec((x2 - x1) * c, 0);
    anchor2.handleIn = new Vec(0, (y1 - y2) * c);
  } else {
    anchor1.handleOut = new Vec(0, (y2 - y1) * c);
    anchor2.handleIn = new Vec((x1 - x2) * c, 0);
  }
};

const getStringAttribute = <T>(svgNode: SVGElement, name: string, defaultValue: T): string | T => {
  if (svgNode.hasAttribute(name)) {
    return svgNode.getAttribute(name)!;
  }
  if (svgNode.style[name]) {
    return svgNode.style[name];
  }
  return defaultValue;
};
const getNumberAttribute = <T>(svgNode: SVGElement, name: string, defaultValue: T): number | T => {
  if (svgNode.hasAttribute(name)) {
    return parseFloat(svgNode.getAttribute(name)!);
  }
  if (svgNode.style[name]) {
    return parseFloat(svgNode.style[name]);
  }
  return defaultValue;
};
const getNumberAndUnitFromString = (s: string) => {
  const numberString = s.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/)?.[0];
  const number = numberString ? parseFloat(numberString) : undefined;
  const unit = s.match(/[^\d.]+$/)?.[0];
  return { number, unit };
};

const transformGeometryForViewbox = (
  geometry: Geometry,
  svgNode: SVGElement,
  options: ImportSVGOptions
) => {
  const viewboxAttribute = getStringAttribute(svgNode, "viewBox", undefined);
  if (viewboxAttribute !== undefined) {
    const viewboxNumbers = viewboxAttribute.split(/[\s,]+/).map((s) => parseFloat(s));
    // Translate so origin is at top-left of viewbox.
    geometry.transform({ position: new Vec(-viewboxNumbers[0], -viewboxNumbers[1]) });

    // Default is points, i.e. 72 dots per inch.
    let scaleFactor = scaleFactorForUnitConversion("pt", options.units);
    const widthAttribute = getStringAttribute(svgNode, "width", undefined);
    if (widthAttribute !== undefined) {
      // If width has a unit, we'll attempt to determine a scale factor.
      let { number: width, unit: widthUnit } = getNumberAndUnitFromString(widthAttribute);
      if (!widthUnit) widthUnit = "pt";
      if (isValidUnit(widthUnit) && width !== undefined) {
        const widthInProjectUnits =
          width * scaleFactorForUnitConversion(widthUnit as Unit, options.units);
        const viewboxWidth = viewboxNumbers[2] - viewboxNumbers[0];
        scaleFactor = widthInProjectUnits / viewboxWidth;
      }
    }
    geometry.transform({ scale: scaleFactor });
    geometry.scaleStroke(scaleFactor);
  }
};

export const geometryFromSVGNode = (
  svgNode: SVGElement,
  options: ImportSVGOptions
): Geometry | undefined => {
  // The general strategy is to convert the svgNode to geometry based on its
  // tagName (ellipse, rect, path, etc) and that tag's specialized attributes
  // (e.g. circle's cx, cy, r), then apply all the generic attributes and css style
  // (transform, stroke, etc) to that geometry.

  // TODO: We assume all numeric units are in pixels (this is typical). But the
  // spec says they can also be in css units and percentages.

  let result: Geometry | undefined;
  const tagName = svgNode.tagName;
  if (tagName === "svg" || tagName === "g") {
    const items: Geometry[] = [];
    for (let childNode of Array.from(svgNode.children)) {
      const childGeometry = geometryFromSVGNode(childNode as SVGElement, options);
      if (childGeometry) {
        items.push(childGeometry);
      }
    }
    result = new Group(items);

    if (tagName === "svg") {
      transformGeometryForViewbox(result, svgNode, options);
    }
  } else if (tagName === "path") {
    const d = getStringAttribute(svgNode, "d", "");
    result = Shape.fromSVGPathString(d);
  } else if (tagName === "polygon") {
    const d = "M" + getStringAttribute(svgNode, "points", "") + "z";
    result = Shape.fromSVGPathString(d);
  } else if (tagName === "polyline") {
    const d = "M" + getStringAttribute(svgNode, "points", "");
    result = Shape.fromSVGPathString(d);
  } else if (tagName === "circle") {
    const cx = getNumberAttribute(svgNode, "cx", 0);
    const cy = getNumberAttribute(svgNode, "cy", 0);
    const r = getNumberAttribute(svgNode, "r", 0);
    if (r > 0) {
      const anchors = [
        new Anchor(new Vec(cx + r, cy)),
        new Anchor(new Vec(cx, cy + r)),
        new Anchor(new Vec(cx - r, cy)),
        new Anchor(new Vec(cx, cy - r)),
      ];
      makeCircularArc(anchors[0], anchors[1], false);
      makeCircularArc(anchors[1], anchors[2], true);
      makeCircularArc(anchors[2], anchors[3], false);
      makeCircularArc(anchors[3], anchors[0], true);
      result = new Path(anchors, true);
    }
  } else if (tagName === "ellipse") {
    const cx = getNumberAttribute(svgNode, "cx", 0);
    const cy = getNumberAttribute(svgNode, "cy", 0);
    const rx = getNumberAttribute(svgNode, "rx", 0);
    const ry = getNumberAttribute(svgNode, "ry", 0);
    if (rx > 0 && ry > 0) {
      const anchors = [
        new Anchor(new Vec(cx + rx, cy)),
        new Anchor(new Vec(cx, cy + ry)),
        new Anchor(new Vec(cx - rx, cy)),
        new Anchor(new Vec(cx, cy - ry)),
      ];
      makeCircularArc(anchors[0], anchors[1], false);
      makeCircularArc(anchors[1], anchors[2], true);
      makeCircularArc(anchors[2], anchors[3], false);
      makeCircularArc(anchors[3], anchors[0], true);
      result = new Path(anchors, true);
    }
  } else if (tagName === "rect") {
    const x = getNumberAttribute(svgNode, "x", 0);
    const y = getNumberAttribute(svgNode, "y", 0);
    const width = getNumberAttribute(svgNode, "width", 0);
    const height = getNumberAttribute(svgNode, "height", 0);
    let rx = getNumberAttribute(svgNode, "rx", null);
    let ry = getNumberAttribute(svgNode, "ry", null);
    if (rx !== null && ry === null) ry = rx;
    if (ry !== null && rx === null) rx = ry;
    if (rx === null || ry === null) {
      const anchors = [
        new Anchor(new Vec(x, y)),
        new Anchor(new Vec(x + width, y)),
        new Anchor(new Vec(x + width, y + height)),
        new Anchor(new Vec(x, y + height)),
      ];
      result = new Path(anchors, true);
    } else {
      rx = clamp(rx, 0, width / 2);
      ry = clamp(ry, 0, height / 2);
      const anchors = [
        new Anchor(new Vec(x + rx, y)),
        new Anchor(new Vec(x + width - rx, y)),
        new Anchor(new Vec(x + width, y + ry)),
        new Anchor(new Vec(x + width, y + height - ry)),
        new Anchor(new Vec(x + width - rx, y + height)),
        new Anchor(new Vec(x + rx, y + height)),
        new Anchor(new Vec(x, y + height - ry)),
        new Anchor(new Vec(x, y + ry)),
      ];
      makeCircularArc(anchors[7], anchors[0], false);
      makeCircularArc(anchors[1], anchors[2], true);
      makeCircularArc(anchors[3], anchors[4], false);
      makeCircularArc(anchors[5], anchors[6], true);
      result = new Path(anchors, true);
    }
  } else if (tagName === "line") {
    const x1 = getNumberAttribute(svgNode, "x1", 0);
    const y1 = getNumberAttribute(svgNode, "y1", 0);
    const x2 = getNumberAttribute(svgNode, "x2", 0);
    const y2 = getNumberAttribute(svgNode, "y2", 0);
    const anchor1 = new Anchor(new Vec(x1, y1));
    const anchor2 = new Anchor(new Vec(x2, y2));
    result = new Path([anchor1, anchor2]);
  } else if (tagName === "text") {
    // TODO
  }
  // TODO: clippath, lineargradient, radialgradient, image, symbol, defs, use, switch

  if (result === undefined) return undefined;

  // Now apply all the attributes (transform, stroke, etc) to result.
  // TODO: parse style attribute
  // See https://www.w3.org/TR/SVG/propidx.html

  const fillAttribute = getStringAttribute(svgNode, "fill", null);
  if (fillAttribute !== null) {
    if (fillAttribute !== "none") {
      const color = Color.fromCSSString(fillAttribute);
      result.assignFill(new Fill(color));
    }
  } else if (tagNamesWithDefaultPaint[tagName]) {
    // default fill is black
    const color = new Color(0, 0, 0, 1);
    result.assignFill(new Fill(color));
  }

  const strokeAttribute = getStringAttribute(svgNode, "stroke", null);
  if (strokeAttribute !== null && strokeAttribute !== "none") {
    const color = Color.fromCSSString(strokeAttribute);
    const width = getNumberAttribute(svgNode, "stroke-width", 1);
    let cap = getStringAttribute(svgNode, "stroke-linecap", undefined);
    if (!Stroke.isValidCap(cap)) cap = undefined;
    let join = getStringAttribute(svgNode, "stroke-linejoin", undefined);
    if (!Stroke.isValidJoin(join)) join = undefined;
    const miterLimit = getNumberAttribute(svgNode, "stroke-miterlimit", undefined);
    const stroke = new Stroke(color, false, width, "centered", cap, join, miterLimit);
    result.assignStroke(stroke);
  }

  const transformAttribute = getStringAttribute(svgNode, "transform", null);
  if (transformAttribute !== null) {
    const matrix = AffineMatrix.fromSVGTransformString(transformAttribute);
    result.affineTransform(matrix);
    // Note: We'll try to scale the stroke but we don't support non-uniform
    // stroke in our geometry model.
    const scaleFactor = Math.sqrt(Math.abs(matrix.determinant()));
    result.scaleStroke(scaleFactor);
  }

  // TODO: fill-opacity, stroke-opacity, opacity, visibility, display
  // TODO: clip-path, gradient-transform, stop-color, offset, stroke-dasharray, stroke-dashoffset
  // TODO: Account for inherited CSS?

  return result;
};

// SVG Exporting

export const pathOrShapeToSVGString = (item: Path | Shape, options?: ExportOptions) => {
  let stroke = item.stroke;
  let fill = item.fill;
  if (!stroke && !fill) {
    // If no stroke or fill, use the default stroke.
    stroke = new Stroke();
  }

  let attrs = "";
  if (!fill) {
    attrs += `fill="none" `;
  } else {
    attrs += `fill="${fill.color.toCSSString()}" fill-rule="evenodd" `;
  }
  if (!stroke) {
    attrs += `stroke="none" `;
  } else {
    attrs += `stroke="${stroke.color.toCSSString()}" `;
    if (stroke.hairline) {
      const hairlineStrokeWidth = options?.hairlineStrokeWidth ?? 1;
      attrs += `stroke-width="${hairlineStrokeWidth}" `;
    } else {
      attrs += `stroke-width="${stroke.width}" `;
    }

    // Let's accumulate all the weird stroke attributes. We'll only add them if
    // they're not the default value.
    let strokeAttrs = "";
    if (stroke) {
      if (stroke.cap !== "butt") {
        strokeAttrs += `stroke-linecap="${stroke.cap}" `;
      }
      if (stroke.join !== "miter") {
        strokeAttrs += `stroke-linejoin="${stroke.join}" `;
      }
      if (stroke.miterLimit !== 4) {
        strokeAttrs += `stroke-miterlimit="${stroke.miterLimit}" `;
      }
    }

    // If we're using inner or outer stroke alignment, we'll need to do fancy
    // stuff to make our SVG work.
    const customAlignment =
      !stroke.hairline &&
      stroke.alignment !== "centered" &&
      !(item instanceof Path && !item.closed);

    if (customAlignment && options?.useSVGPathClipping) {
      const d = item.toSVGPathString(options);
      let clipD = d;
      if (stroke.alignment === "outer") {
        // Put a big box around it to flip positive and negative.
        clipD = "M-1e9,-1e9 L1e9,-1e9 L1e9,1e9 L-1e9,1e9 Z " + clipD;
      }
      const clipId = "clip" + hashString(clipD);
      let result = "";

      // We draw the filled shape in the first pass.
      if (fill) {
        result += `<path d="${d}" fill="${fill.color.toCSSString()}" fill-rule="evenodd"/>`;
      }

      // Then we draw the stroke at 2x width, but clipped.
      result += `<clipPath id="${clipId}"><path d="${clipD}" clip-rule="evenodd"/></clipPath>`;
      result += `<path d="${d}" clip-path="url(#${clipId})" fill="none" stroke="${stroke.color.toCSSString()}" stroke-width="${
        stroke.width * 2
      }" ${strokeAttrs}/>`;
      return result;
    }

    if (customAlignment) {
      // We'll modify the original geometry by expanding (outer) or contracting
      // (inner) it by half the stroke width. This is how e.g. Figma exports
      // non-centered strokes.
      const stroked = Shape.stroke(item, { width: stroke.width });
      if (stroke.alignment === "outer") {
        item = Shape.booleanUnion([item, stroked]);
      } else if (stroke.alignment === "inner") {
        item = Shape.booleanDifference([item, stroked]);
      }
    }

    // Add other stroke attributes if they're not the default value.
    attrs += strokeAttrs;
  }
  const d = item.toSVGPathString(options);
  return `<path d="${d}" ${attrs}/>`;
};

// via https://gist.github.com/victor-homyakov/bcb7d7911e4a388b1c810f8c3ce17bcf
const hashString = (str: string) => {
  let hash = 5381;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
};
