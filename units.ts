export type Unit = "in" | "ft" | "mm" | "cm" | "m" | "px" | "pc" | "pt";
export type UnitName =
  | "inches"
  | "feet"
  | "millimeters"
  | "centimeters"
  | "meters"
  | "pixels"
  | "picas"
  | "points";

export const units: Unit[] = ["in", "ft", "mm", "cm", "m", "px", "pc", "pt"];

export const unitNames: { [U in Unit]: UnitName } = {
  in: "inches",
  ft: "feet",
  mm: "millimeters",
  cm: "centimeters",
  m: "meters",
  px: "pixels",
  pc: "picas",
  pt: "points",
};

// Scale factor to convert from given unit to inches.
export const unitScaleFactors: { [U in Unit]: number } = {
  in: 1,
  ft: 12,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  m: 1000 / 25.4,
  px: 1 / 96,
  pc: 1 / 6,
  pt: 1 / 72,
};

export const isValidUnit = (unit: string): unit is Unit => {
  return unitNames.hasOwnProperty(unit);
};

/**
 * Returns a scale factor to transform a value in sourceUnit to a value in
 * targetUnit.
 */
export const scaleFactorForUnitConversion = (sourceUnit: Unit, targetUnit: Unit) => {
  return unitScaleFactors[sourceUnit] / unitScaleFactors[targetUnit];
};

export const unitForUnitName = (unitName: UnitName) => {
  for (let unit of units) {
    if (unitNames[unit] === unitName) return unit;
  }
  throw `Invalid unit name: ${unitName}`;
};
