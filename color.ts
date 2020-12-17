import { expressionCodeForNumber } from "./math";

// Color conversions via https://github.com/Qix-/color-convert/blob/master/conversions.js
export class Color {
  static displayName = "Color";

  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  clone() {
    return new Color(this.r, this.g, this.b, this.a);
  }

  equals(color: Color) {
    return this.r === color.r && this.g === color.g && this.b === color.b && this.a === color.a;
  }

  toCSSString() {
    const r = Math.round(this.r * 255);
    const g = Math.round(this.g * 255);
    const b = Math.round(this.b * 255);
    if (this.a === 1) {
      // We want to support lowest common denominator. Glowforge doesn't like
      // rgba(). K40 Whisperer doesn't like rgb(). So we use the oldest method
      // for specifying a color, a hex code. Code via
      // https://stackoverflow.com/a/19765382
      const rgb = b | (g << 8) | (r << 16);
      return "#" + (0x1000000 + rgb).toString(16).slice(1);
    } else {
      return `rgba(${r}, ${g}, ${b}, ${this.a})`;
    }
  }

  toExpressionCode(minFractionDigits = 0, maxFractionDigits = 3) {
    const { r, g, b, a } = this;
    const expr = (x: number) => expressionCodeForNumber(x, minFractionDigits, maxFractionDigits);
    return `Color(${expr(r)}, ${expr(g)}, ${expr(b)}, ${expr(a)})`;
  }

  toHSVA() {
    let h: number, s: number;
    const { r, g, b, a } = this;
    const v = Math.max(r, g, b);
    const diff = v - Math.min(r, g, b);
    const diffc = (c: number) => {
      return (v - c) / 6 / diff + 1 / 2;
    };
    if (diff === 0) {
      h = s = 0;
    } else {
      s = diff / v;
      const rdif = diffc(r);
      const gdif = diffc(g);
      const bdif = diffc(b);
      if (r === v) {
        h = bdif - gdif;
      } else if (g === v) {
        h = 1 / 3 + rdif - bdif;
      } else {
        // b === v
        h = 2 / 3 + gdif - rdif;
      }
      if (h < 0) {
        h += 1;
      } else if (h > 1) {
        h -= 1;
      }
    }
    return [h, s, v, a];
  }

  static isValid(color: unknown): color is Color {
    return (
      color instanceof Color &&
      typeof color.r === "number" &&
      typeof color.g === "number" &&
      typeof color.b === "number" &&
      typeof color.a === "number"
    );
  }

  static fromHSVA(h: number, s: number, v: number, a: number) {
    h = h * 6;
    const hi = Math.floor(h) % 6;

    const f = h - Math.floor(h);
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));

    switch (hi) {
      case 0:
        return new Color(v, t, p, a);
      case 1:
        return new Color(q, v, p, a);
      case 2:
        return new Color(p, v, t, a);
      case 3:
        return new Color(p, q, v, a);
      case 4:
        return new Color(t, p, v, a);
      default:
        return new Color(v, p, q, a);
    }
  }

  static fromCSSString(cssString: string) {
    // see: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
    // keyword, hex, rgb, rgba, hsl, hsla

    cssString = cssString.trim().toLowerCase();

    // keyword
    const fromKeyword = cssColorKeywords[cssString];
    if (fromKeyword) {
      return new Color(
        fromKeyword[0] / 255,
        fromKeyword[1] / 255,
        fromKeyword[2] / 255,
        fromKeyword[3]
      );
    }

    // hex
    if (cssString[0] === "#") {
      if (cssString.length === 4) {
        return new Color(fromHex1(cssString[1]), fromHex1(cssString[2]), fromHex1(cssString[3]));
      } else if (cssString.length === 5) {
        return new Color(
          fromHex1(cssString[1]),
          fromHex1(cssString[2]),
          fromHex1(cssString[3]),
          fromHex1(cssString[4])
        );
      } else if (cssString.length === 7) {
        return new Color(
          fromHex2(cssString.slice(1, 3)),
          fromHex2(cssString.slice(3, 5)),
          fromHex2(cssString.slice(5, 7))
        );
      } else if (cssString.length === 9) {
        return new Color(
          fromHex2(cssString.slice(1, 3)),
          fromHex2(cssString.slice(3, 5)),
          fromHex2(cssString.slice(5, 7)),
          fromHex2(cssString.slice(7, 9))
        );
      }
    }

    // rgb
    const rgb = cssString.match(/^rgb\s*\(\s*(\d+%?)[\s,]+(\d+%?)[\s,]+(\d+%?)\s*\)$/);
    if (rgb) {
      return new Color(from255String(rgb[1]), from255String(rgb[2]), from255String(rgb[3]));
    }

    // rgba
    const rgba = cssString.match(
      /^rgba\s*\(\s*(\d+%?)[\s,]+(\d+%?)[\s,]+(\d+%?)[\s,]+(\d+%?)\s*\)$/
    );
    if (rgba) {
      return new Color(
        from255String(rgba[1]),
        from255String(rgba[2]),
        from255String(rgba[3]),
        from255String(rgba[4])
      );
    }

    // TODO: hsl, hsla. Look out for "deg".
    // https://github.com/Qix-/color-convert/blob/master/conversions.js

    // Not a valid color.
    return new Color();
  }
}

const fromHex1 = (s: string) => parseInt("" + s + s, 16) / 255;
const fromHex2 = (s: string) => parseInt(s, 16) / 255;
const from255String = (s: string) => {
  const percent = s.match(/^(\d+)%$/);
  if (percent) {
    return parseInt(percent[1], 10) / 100;
  }
  return parseInt(s, 10) / 255;
};

// via https://github.com/corysimmons/colors.json/blob/master/colors.json
const cssColorKeywords: { [name: string]: [number, number, number, number] } = {
  aliceblue: [240, 248, 255, 1],
  antiquewhite: [250, 235, 215, 1],
  aqua: [0, 255, 255, 1],
  aquamarine: [127, 255, 212, 1],
  azure: [240, 255, 255, 1],
  beige: [245, 245, 220, 1],
  bisque: [255, 228, 196, 1],
  black: [0, 0, 0, 1],
  blanchedalmond: [255, 235, 205, 1],
  blue: [0, 0, 255, 1],
  blueviolet: [138, 43, 226, 1],
  brown: [165, 42, 42, 1],
  burlywood: [222, 184, 135, 1],
  cadetblue: [95, 158, 160, 1],
  chartreuse: [127, 255, 0, 1],
  chocolate: [210, 105, 30, 1],
  coral: [255, 127, 80, 1],
  cornflowerblue: [100, 149, 237, 1],
  cornsilk: [255, 248, 220, 1],
  crimson: [220, 20, 60, 1],
  cyan: [0, 255, 255, 1],
  darkblue: [0, 0, 139, 1],
  darkcyan: [0, 139, 139, 1],
  darkgoldenrod: [184, 134, 11, 1],
  darkgray: [169, 169, 169, 1],
  darkgreen: [0, 100, 0, 1],
  darkgrey: [169, 169, 169, 1],
  darkkhaki: [189, 183, 107, 1],
  darkmagenta: [139, 0, 139, 1],
  darkolivegreen: [85, 107, 47, 1],
  darkorange: [255, 140, 0, 1],
  darkorchid: [153, 50, 204, 1],
  darkred: [139, 0, 0, 1],
  darksalmon: [233, 150, 122, 1],
  darkseagreen: [143, 188, 143, 1],
  darkslateblue: [72, 61, 139, 1],
  darkslategray: [47, 79, 79, 1],
  darkslategrey: [47, 79, 79, 1],
  darkturquoise: [0, 206, 209, 1],
  darkviolet: [148, 0, 211, 1],
  deeppink: [255, 20, 147, 1],
  deepskyblue: [0, 191, 255, 1],
  dimgray: [105, 105, 105, 1],
  dimgrey: [105, 105, 105, 1],
  dodgerblue: [30, 144, 255, 1],
  firebrick: [178, 34, 34, 1],
  floralwhite: [255, 250, 240, 1],
  forestgreen: [34, 139, 34, 1],
  fuchsia: [255, 0, 255, 1],
  gainsboro: [220, 220, 220, 1],
  ghostwhite: [248, 248, 255, 1],
  gold: [255, 215, 0, 1],
  goldenrod: [218, 165, 32, 1],
  gray: [128, 128, 128, 1],
  green: [0, 128, 0, 1],
  greenyellow: [173, 255, 47, 1],
  grey: [128, 128, 128, 1],
  honeydew: [240, 255, 240, 1],
  hotpink: [255, 105, 180, 1],
  indianred: [205, 92, 92, 1],
  indigo: [75, 0, 130, 1],
  ivory: [255, 255, 240, 1],
  khaki: [240, 230, 140, 1],
  lavender: [230, 230, 250, 1],
  lavenderblush: [255, 240, 245, 1],
  lawngreen: [124, 252, 0, 1],
  lemonchiffon: [255, 250, 205, 1],
  lightblue: [173, 216, 230, 1],
  lightcoral: [240, 128, 128, 1],
  lightcyan: [224, 255, 255, 1],
  lightgoldenrodyellow: [250, 250, 210, 1],
  lightgray: [211, 211, 211, 1],
  lightgreen: [144, 238, 144, 1],
  lightgrey: [211, 211, 211, 1],
  lightpink: [255, 182, 193, 1],
  lightsalmon: [255, 160, 122, 1],
  lightseagreen: [32, 178, 170, 1],
  lightskyblue: [135, 206, 250, 1],
  lightslategray: [119, 136, 153, 1],
  lightslategrey: [119, 136, 153, 1],
  lightsteelblue: [176, 196, 222, 1],
  lightyellow: [255, 255, 224, 1],
  lime: [0, 255, 0, 1],
  limegreen: [50, 205, 50, 1],
  linen: [250, 240, 230, 1],
  magenta: [255, 0, 255, 1],
  maroon: [128, 0, 0, 1],
  mediumaquamarine: [102, 205, 170, 1],
  mediumblue: [0, 0, 205, 1],
  mediumorchid: [186, 85, 211, 1],
  mediumpurple: [147, 112, 219, 1],
  mediumseagreen: [60, 179, 113, 1],
  mediumslateblue: [123, 104, 238, 1],
  mediumspringgreen: [0, 250, 154, 1],
  mediumturquoise: [72, 209, 204, 1],
  mediumvioletred: [199, 21, 133, 1],
  midnightblue: [25, 25, 112, 1],
  mintcream: [245, 255, 250, 1],
  mistyrose: [255, 228, 225, 1],
  moccasin: [255, 228, 181, 1],
  navajowhite: [255, 222, 173, 1],
  navy: [0, 0, 128, 1],
  oldlace: [253, 245, 230, 1],
  olive: [128, 128, 0, 1],
  olivedrab: [107, 142, 35, 1],
  orange: [255, 165, 0, 1],
  orangered: [255, 69, 0, 1],
  orchid: [218, 112, 214, 1],
  palegoldenrod: [238, 232, 170, 1],
  palegreen: [152, 251, 152, 1],
  paleturquoise: [175, 238, 238, 1],
  palevioletred: [219, 112, 147, 1],
  papayawhip: [255, 239, 213, 1],
  peachpuff: [255, 218, 185, 1],
  peru: [205, 133, 63, 1],
  pink: [255, 192, 203, 1],
  plum: [221, 160, 221, 1],
  powderblue: [176, 224, 230, 1],
  purple: [128, 0, 128, 1],
  red: [255, 0, 0, 1],
  rosybrown: [188, 143, 143, 1],
  royalblue: [65, 105, 225, 1],
  saddlebrown: [139, 69, 19, 1],
  salmon: [250, 128, 114, 1],
  sandybrown: [244, 164, 96, 1],
  seagreen: [46, 139, 87, 1],
  seashell: [255, 245, 238, 1],
  sienna: [160, 82, 45, 1],
  silver: [192, 192, 192, 1],
  skyblue: [135, 206, 235, 1],
  slateblue: [106, 90, 205, 1],
  slategray: [112, 128, 144, 1],
  slategrey: [112, 128, 144, 1],
  snow: [255, 250, 250, 1],
  springgreen: [0, 255, 127, 1],
  steelblue: [70, 130, 180, 1],
  tan: [210, 180, 140, 1],
  teal: [0, 128, 128, 1],
  thistle: [216, 191, 216, 1],
  tomato: [255, 99, 71, 1],
  transparent: [0, 0, 0, 0],
  turquoise: [64, 224, 208, 1],
  violet: [238, 130, 238, 1],
  wheat: [245, 222, 179, 1],
  white: [255, 255, 255, 1],
  whitesmoke: [245, 245, 245, 1],
  yellow: [255, 255, 0, 1],
  yellowgreen: [154, 205, 50, 1],
  rebeccapurple: [102, 51, 153, 1],
};
