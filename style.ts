import { Color } from "./color";

export type StrokeAlignment = "centered" | "inner" | "outer";
export type StrokeCap = "butt" | "round" | "square";
export type StrokeJoin = "miter" | "round" | "bevel";

export class Stroke {
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

  static isValid(stroke: unknown): stroke is Stroke {
    return (
      stroke instanceof Stroke &&
      Color.isValid(stroke.color) &&
      typeof stroke.hairline === "boolean" &&
      typeof stroke.width === "number" &&
      (stroke.alignment === "centered" ||
        stroke.alignment === "inner" ||
        stroke.alignment === "outer") &&
      (stroke.cap === "butt" || stroke.cap === "round" || stroke.cap === "square") &&
      (stroke.join === "miter" || stroke.join === "round" || stroke.join === "bevel") &&
      typeof stroke.miterLimit === "number"
    );
  }
}

export class Fill {
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
