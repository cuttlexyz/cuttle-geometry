import { _initPathKit } from "./pathkit";

export * from "./anchor";
export * from "./axis";
export * from "./bounding-box";
export * from "./color";
export * from "./constants";
export * from "./geometry";
export * from "./group";
export * from "./math";
export * from "./matrix";
export * from "./path";
export * from "./random";
export * from "./segment";
export * from "./shape";
export * from "./style";
export * from "./units";
export * from "./util";
export * from "./vec";

/**
 * Initialize Cuttle's internal PathKit instance. PathKit is used for boolean
 * operations.
 *
 * @remarks
 * This function should be called only once on application start.
 */
export const initCuttleGeometry = async () => {
  return await _initPathKit();
};
