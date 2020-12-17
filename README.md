# Cuttle Geometry

This library is a part of [Cuttle](https://cuttle.xyz), a design tool for digital cutting machines. It's currently considered _alpha_ level software. The API will change, but is presented here as reference for anyone writing Modifier or Generator code.

## Cloning

In general, methods that begin with a _verb_ mutate rather than returning a copy.

```js
let a = Vec(1, 2);
let b = Vec(3, 4);
a.add(b);

console.log(a); // Vec {x: 4, y: 6}
```

The exception to this rule is the `clone()` method, which returns a copy. Use `clone()` when you don't want to mutate the original instance.

```js
let a = Vec(1, 2);
let c = a.clone().mulScalar(2);

console.log(a); // Vec {x: 1, y: 2}
console.log(c); // Vec {x: 2, y: 4}
```

## Chaining

Mutating methods return `this`, which allows them to be chained

```js
let a = Vec(1, 2);
a.rotate(90).mulScalar(2);

console.log(a); // Vec {x: -4, y: 2}
```

## Working with Paths

Similar to other 2D vector editors, Cuttle represents Paths as a series of connected cubic Bezier curves.

### Time

Continous path operations use "time" to describe a position along the path, starting at the first anchor. The integer part of "time" represents the index of the segment and the fractional part represents the position along that segment.

```
0-------1-------2-------3
                    ^ time = 2.5
```

### Distance

Time is not usually convenient to work with directly, since it is not garaunteed to be uniform across the path. Usually you'll want to use `path.timeAtDistance()` to convert a distance value in project units to path time.

A typical example of distributing positions along a path with distance, assuming some `path` exists already.

```js
const count = 10;
const pathLength = path.length();
const points = range(count).map((i) => {
  const interpolation = i / (count - 1); // Map the i to the 0 -> 1 range
  const distance = interpolation * pathLength; // Multiply by the total length of the path
  const time = path.timeAtDistance(distance); // Convert distance to time
  return path.positionAtTime(time); // Use time to get a position on the path
});
```

## Generators vs Modifiers

There are two ways of writing code that produces geometry in Cuttle; Generators and Modifiers.

Generators produce geometry purely from their parameters. Styles (Stroke and Fill) are applied to the result. Generator output serves as the **base** geometry.

Modifiers can be stacked on top of **base** Components and Generators, and other Modifiers. Code-wise the key difference is that they take `input` geometry. Modifier `input` geometry is cloned before being passed to the Modifier code block, so it can safely be modified.

## Example Modifier: Rainbow

See: https://cuttle.xyz/@notlion/Rainbow-Repeat-tGFddY4JjbV2

```js
// Parameters:
// hueStart - Hue at the start of the rainbow
// hueEnd   - Hue at the end of the rainbow

// Input will always be a Group. We can directly iterate over its items and assign a Fill to each one.
input.items.forEach((geom, i) => {
  const t = i / input.items.length;
  const h = mix(hueStart, hueEnd, t) / 360;
  geom.assignFill(Fill(Color.fromHSVA(h, 1, 1, 1)));
});

// Return the mutated input
return input;
```

## Example Modifier: CloneAlongPath

See: https://cuttle.xyz/@notlion/CloneAlongPath-AfgZT9HW8tCf

```js
// Parameters:
// geometry - Geometry to clone
// copies   - How many copies of the shape to

// Sometimes only one type of Geometry makes sense as an input. This Modifier only works on paths. We can use input.allPaths() to recursively find every Path in the input. That means this modifier will work even if the input is a Group of Paths, a Shape or even a Group of Groups of Paths!
return input.allPaths().map((path) => {
  // Draw the path for reference (this won't be included in the output geometry)
  console.geometry(path);

  const length = path.length();
  return range(copies).map((i) => {
    // Calculate the desired distance along the path (in project units)
    const distance = (i / (copies - 1)) * length;

    // Convert distance to path time
    const time = path.timeAtDistance(distance);

    // Use the time to calculate poisition and tangent from our path.
    const position = path.positionAtTime(time);
    const rotation = path.tangentAtTime(time).angle();

    // Return a transformed copy of the geometry
    return geometry.clone().transform({
      position,
      rotation,
    });
  });
});
```
