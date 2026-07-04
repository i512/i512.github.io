// Fire simulation for a vertical row of LEDs.
// Paste this into the visualizer editor.
// Assumes height is encoded by led.z, but does not require a fixed LED count.

if (leds.length === 0) {
  return;
}

let minZ = Infinity;
let maxZ = -Infinity;

for (const led of leds) {
  minZ = Math.min(minZ, led.z);
  maxZ = Math.max(maxZ, led.z);
}

const heightRange = Math.max(1, maxZ - minZ);

function hash(value) {
  return Math.sin(value * 127.1) * 43758.5453 % 1;
}

function noise(seed) {
  return Math.abs(hash(seed));
}

function fireColor(heat) {
  heat = clamp(heat, 0, 1);

  if (heat < 0.35) {
    const amount = heat / 0.35;
    return rgb(120 * amount, 8 * amount, 0);
  }

  if (heat < 0.72) {
    const amount = (heat - 0.35) / 0.37;
    return rgb(120 + 135 * amount, 8 + 88 * amount, 0);
  }

  const amount = (heat - 0.72) / 0.28;
  return rgb(255, 96 + 132 * amount, 18 + 120 * amount);
}

for (const led of leds) {
  const height = (led.z - minZ) / heightRange;
  const baseHeat = Math.pow(1 - height, 1.35);
  const flameWave = Math.sin(time * 9 + led.z * 0.9 + led.x * 0.35 + led.y * 0.21) * 0.12;
  const emberFlicker = noise(iteration * 0.37 + led.x * 2.1 + led.y * 3.7 + led.z * 5.3) * 0.28;
  const cooling = height * (0.28 + noise(time * 0.7 + led.z) * 0.18);
  const heat = baseHeat + flameWave + emberFlicker - cooling;
  const color = fireColor(heat);

  led.r = color.r;
  led.g = color.g;
  led.b = color.b;
}
