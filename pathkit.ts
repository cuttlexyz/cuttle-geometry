import { PathKitInit } from "../deps";
import { Anchor } from "./anchor";
import { BoundingBox } from "./bounding-box";
import { Geometry } from "./geometry";
import { Group } from "./group";
import { Path } from "./path";
import { Shape } from "./shape";
import { Vec } from "./vec";

// PathKit is made to work with geometry in pixels, but most of our geometry
// (e.g. in inches) is smaller. So we universally scale up our pkPaths by this
// factor, and then scale them down when we convert back to geometry. If we
// don't do this, we start seeing glitches at smaller scales.
const scaleFactor = 10000;

export let PathKit: any = null;

// This function must be awaited before calling anything that uses PathKit.
export async function _initPathKit() {
  console.assert(!PathKit);
  PathKit = await PathKitInit({ locateFile: (file: string) => "/" + file }).ready();
}

type PkPath = any;
type PkCommand = number[];

//
// Converting to PkCommands
//

const pkCommandForSegment = (a1: Anchor, a2: Anchor): PkCommand => {
  if (a1.handleOut.x !== 0 || a1.handleOut.y !== 0 || a2.handleIn.x !== 0 || a2.handleIn.y !== 0) {
    return [
      PathKit.CUBIC_VERB,
      (a1.position.x + a1.handleOut.x) * scaleFactor,
      (a1.position.y + a1.handleOut.y) * scaleFactor,
      (a2.position.x + a2.handleIn.x) * scaleFactor,
      (a2.position.y + a2.handleIn.y) * scaleFactor,
      a2.position.x * scaleFactor,
      a2.position.y * scaleFactor,
    ];
  } else {
    return [PathKit.LINE_VERB, a2.position.x * scaleFactor, a2.position.y * scaleFactor];
  }
};
export const toPkCommands = (item: Geometry, scaleFactor: number = 1): PkCommand[] => {
  const pkCommands: PkCommand[] = [];
  const recurse = (item: Geometry) => {
    if (item instanceof Path) {
      const path = item;
      if (path.anchors.length === 0) return;
      let a1 = path.anchors[0];
      pkCommands.push([
        PathKit.MOVE_VERB,
        a1.position.x * scaleFactor,
        a1.position.y * scaleFactor,
      ]);
      for (let i = 1, n = path.anchors.length; i < n; ++i) {
        let a2 = path.anchors[i];
        pkCommands.push(pkCommandForSegment(a1, a2));
        a1 = a2;
      }
      if (path.closed) {
        pkCommands.push(pkCommandForSegment(a1, path.anchors[0]));
        pkCommands.push([PathKit.CLOSE_VERB]);
      }
    } else if (item instanceof Shape) {
      for (let path of item.paths) {
        recurse(path);
      }
    } else if (item instanceof Group) {
      for (let child of item.items) {
        recurse(child);
      }
    }
  };
  recurse(item);
  return pkCommands;
};

//
// Converting from PkCommands
//

class Conic {
  p0: Vec;
  p1: Vec;
  p2: Vec;
  w: number;

  constructor(p0: Vec, p1: Vec, p2: Vec, w: number) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.w = w;
  }

  subdivide() {
    // http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.131.4487&rep=rep1&type=pdf
    // Page 6
    const { p0, p1, p2, w } = this;
    const q0 = p0;
    const q1 = p0
      .clone()
      .add(p1.clone().mulScalar(w))
      .mulScalar(1 / (1 + w));
    const q2 = p0
      .clone()
      .add(p1.clone().mulScalar(2 * w))
      .add(p2)
      .mulScalar(1 / (2 + 2 * w));
    const q3 = p1
      .clone()
      .mulScalar(w)
      .add(p2)
      .mulScalar(1 / (1 + w));
    const q4 = p2;
    const qw = Math.sqrt((1 + w) / 2);
    return [new Conic(q0, q1, q2, qw), new Conic(q2, q3, q4, qw)];
  }

  approximateCubic(): Anchor[] {
    const { p0, p1, p2, w } = this;
    const lambda = ((4 / 3) * w) / (1 + w);
    const handleOut = p1.clone().sub(p0).mulScalar(lambda);
    const handleIn = p1.clone().sub(p2).mulScalar(lambda);
    return [new Anchor(p0, new Vec(), handleOut), new Anchor(p2, handleIn, new Vec())];
  }

  approximateCubicPieces(): Anchor[] {
    if (Math.abs(this.w - 1) < 0.01) {
      return this.approximateCubic();
    }
    const [c1, c2] = this.subdivide();
    const anchors1 = c1.approximateCubicPieces();
    const anchors2 = c2.approximateCubicPieces();
    anchors2[0].handleIn = anchors1[anchors1.length - 1].handleIn;
    anchors1.pop();
    return [...anchors1, ...anchors2];
  }
}

export const fromPkCommands = (pkCommands: PkCommand[], scaleFactor: number = 1): Shape => {
  const invScaleFactor = 1 / scaleFactor;
  const paths: Path[] = [];
  let currentPath: Path | null = null;

  for (let command of pkCommands) {
    const verb = command[0];
    if (verb === PathKit.MOVE_VERB) {
      const position = new Vec(command[1] * invScaleFactor, command[2] * invScaleFactor);
      const anchor = new Anchor(position);
      currentPath = new Path([anchor]);
      paths.push(currentPath);
    } else if (verb === PathKit.LINE_VERB && currentPath) {
      const position = new Vec(command[1] * invScaleFactor, command[2] * invScaleFactor);
      const anchor = new Anchor(position);
      currentPath.anchors.push(anchor);
    } else if (verb === PathKit.CUBIC_VERB && currentPath) {
      const lastAnchor = currentPath.anchors[currentPath.anchors.length - 1];
      lastAnchor.handleOut = new Vec(
        command[1] * invScaleFactor - lastAnchor.position.x,
        command[2] * invScaleFactor - lastAnchor.position.y
      );
      const position = new Vec(command[5] * invScaleFactor, command[6] * invScaleFactor);
      const handleIn = new Vec(
        command[3] * invScaleFactor - position.x,
        command[4] * invScaleFactor - position.y
      );
      const anchor = new Anchor(position, handleIn);
      currentPath.anchors.push(anchor);
    } else if ((verb === PathKit.QUAD_VERB || verb === PathKit.CONIC_VERB) && currentPath) {
      // We don't make Conics or Quads but sometimes PathKit makes them when performing Strokes.
      // Conic Approximation via http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.131.4487&rep=rep1&type=pdf
      // "An analysis of cubic approximation schemes for conic sections" - M Floater

      const lastAnchor = currentPath.anchors[currentPath.anchors.length - 1];
      const weight = verb === PathKit.CONIC_VERB ? command[5] : 1;

      const p0 = lastAnchor.position;
      const p1 = new Vec(command[1] * invScaleFactor, command[2] * invScaleFactor);
      const p2 = new Vec(command[3] * invScaleFactor, command[4] * invScaleFactor);

      const conic = new Conic(p0, p1, p2, weight);
      // TODO: Should this be conic.approximateCubicPieces()? Need to see where
      // Conics get used and what kind of approximation is acceptable.
      const anchors = conic.approximateCubic();

      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        if (i === 0) {
          lastAnchor.handleOut = anchor.handleOut;
        } else {
          currentPath.anchors.push(anchor);
        }
      }
    } else if (verb === PathKit.CLOSE_VERB && currentPath) {
      currentPath.closed = true;
    }
  }

  return new Shape(paths);
};

//
// Creating, copying, and deleting PkPaths
//

// We keep track of the number of pkPaths created to ensure we don't forget to
// delete one (a memory leak).
let numPkObjects = 0;
setInterval(() => {
  if (numPkObjects !== 0) {
    console.warn("PathKit memory leak", numPkObjects);
  }
}, 1000);

export const emptyPkPath = (): PkPath => {
  numPkObjects++;
  return PathKit.NewPath();
};

export const toPkPath = (item: Geometry, fillType = PathKit.FillType.EVENODD): PkPath => {
  numPkObjects++;
  const pkCommands = toPkCommands(item, scaleFactor);
  const pkPath = PathKit.FromCmds(pkCommands);
  pkPath.setFillType(fillType);
  return pkPath;
};

export const fromPkPath = (pkPath: PkPath, andDelete = false): Shape => {
  // Ensure even-odd fill type
  if (pkPath.getFillType() !== PathKit.FillType.EVENODD) {
    pkPath.setFillType(PathKit.FillType.EVENODD);
  }
  const pkCommands = pkPath.toCmds();
  const shape = fromPkCommands(pkCommands, scaleFactor);
  if (andDelete) {
    deletePkPath(pkPath);
  }
  return shape;
};

export const copyPkPath = (pkPath: PkPath): PkPath => {
  numPkObjects++;
  return pkPath.copy();
};

export const deletePkPath = (pkPath: PkPath) => {
  numPkObjects--;
  pkPath.delete();
};

export const pkPathFromSVGPathString = (svgPathString: string): PkPath => {
  numPkObjects++;
  return PathKit.FromSVGString(svgPathString).transform(
    scaleFactor,
    0,
    0,
    0,
    scaleFactor,
    0,
    0,
    0,
    1
  );
};

//
// Stroke
//

export const performStroke = (
  pkPath: PkPath,
  width: number,
  cap: string,
  join: string,
  miterLimit: number
) => {
  pkPath.stroke({
    width: width * scaleFactor,
    miter_limit: miterLimit,
    join: PathKit.StrokeJoin[join.toUpperCase()],
    cap: PathKit.StrokeCap[cap.toUpperCase()],
  });
  pkPath.simplify();
};

//
// Bounding box
//

// TODO: Replace PathKit implementation with something like this?
// https://iquilezles.org/www/articles/bezierbbox/bezierbbox.htm
export const computeTightBoundingBox = (item: Geometry) => {
  const pkPath = toPkPath(item);
  const bounds = pkPath.computeTightBounds();
  deletePkPath(pkPath);
  return new BoundingBox(
    new Vec(bounds.fLeft / scaleFactor, bounds.fTop / scaleFactor),
    new Vec(bounds.fRight / scaleFactor, bounds.fBottom / scaleFactor)
  );
};
