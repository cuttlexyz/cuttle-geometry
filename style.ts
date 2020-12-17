import { Color } from "./color";

export type StrokeAlignment = "centered" | "inner" | "outer";
export type StrokeCap = "butt" | "round" | "square";
export type StrokeJoin = "miter" | "round" | "bevel";

export class Stroke {
  static displayName = "Stroke";

  color: Color;
  hairline: boolean;
  width: number;
  alignment: StrokeAlignment;
  cap: StrokeCap;
  join: StrokeJoin;
  miterLimit: number;

  constructor(
    color = new Color(),
    hairline = true,
    width = 0.1,
    alignment: StrokeAlignment = "centered",
    cap: StrokeCap = "butt",
    join: StrokeJoin = "miter",
    miterLimit = 4
  ) {
    this.color = color;
    this.hairline = hairline;
    this.width = width;
    this.alignment = alignment;
    this.cap = cap;
    this.join = join;
    this.miterLimit = miterLimit;
  }

  clone() {
    return new Stroke(
      this.color.clone(),
      this.hairline,
      this.width,
      this.alignment,
      this.cap,
      this.join,
      this.miterLimit
    );
  }

  static isValidAlignment(alignment: unknown): alignment is StrokeAlignment {
    return alignment === "centered" || alignment === "inner" || alignment === "outer";
  }
  static isValidCap(cap: unknown): cap is StrokeCap {
    return cap === "butt" || cap === "round" || cap === "square";
  }
  static isValidJoin(join: unknown): join is StrokeJoin {
    return join === "miter" || join === "round" || join === "bevel";
  }

  static isValid(stroke: unknown): stroke is Stroke {
    return (
      stroke instanceof Stroke &&
      Color.isValid(stroke.color) &&
      typeof stroke.hairline === "boolean" &&
      typeof stroke.width === "number" &&
      typeof stroke.miterLimit === "number" &&
      Stroke.isValidAlignment(stroke.alignment) &&
      Stroke.isValidCap(stroke.cap) &&
      Stroke.isValidJoin(stroke.join)
    );
  }
}

export class Fill {
  static displayName = "Fill";

  color: Color;

  constructor(color = new Color(0, 0, 0, 1)) {
    this.color = color;
  }

  clone() {
    return new Fill(this.color.clone());
  }

  static isValid(fill: unknown): fill is Fill {
    return fill instanceof Fill && Color.isValid(fill.color);
  }
}
