import { seedrandom } from "../deps";
import { TAU } from "./constants";
import { Vec } from "./vec";

export class RandomGenerator {
  private _rng: seedrandom.prng;

  constructor(seed?: string) {
    this._rng = seedrandom(seed);
  }

  seed(seed?: string) {
    this._rng = seedrandom(seed);
  }

  random(min?: number, max?: number) {
    if (max === undefined) {
      max = min === undefined ? 1 : min;
      min = 0;
    } else if (min === undefined) {
      min = 0;
    }

    return min + this._rng() * (max - min);
  }

  randomInt(min?: number, max?: number) {
    if (max === undefined) {
      max = min === undefined ? 0 : min;
      min = 0;
    } else if (min === undefined) {
      min = 0;
    }

    min = min | 0;
    max = max | 0;

    const integer = Math.abs(this._rng.int32());
    if (max > 0) {
      return min + (integer % (max - min + 1));
    }
    return integer;
  }

  randomDirection(length = 1) {
    return new Vec(length, 0).rotateRadians(this.random(TAU));
  }

  randomPointInDisc(radius = 1) {
    return this.randomDirection(radius * Math.sqrt(this._rng()));
  }
}

const globalRandomGenerator = new RandomGenerator();

export const _seedGlobalRandom = (seed: string) => globalRandomGenerator.seed(seed);

export const random = (min?: number, max?: number) => globalRandomGenerator.random(min, max);
export const randomInt = (min?: number, max?: number) => globalRandomGenerator.randomInt(min, max);
export const randomDirection = (length?: number) => globalRandomGenerator.randomDirection(length);
export const randomPointInDisc = (radius?: number) => {
  return globalRandomGenerator.randomPointInDisc(radius);
};
