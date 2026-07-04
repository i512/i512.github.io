// Mutate leds every interval tick.
// Each LED has { x, y, z, r, g, b }.
//leds.particles = null;

if (leds.particles == null) {
  leds.particles = Array.from({length: 50}, () => (
     {
        pos: 0,
        energy: 1,
        speed: 1,
        color: 0,
     }
  ));
}

for (let led of leds) {
  led.r = 0;
  led.g = 0;
  led.b = 0;
}

for (let particle of leds.particles) {
  particle.pos += particle.speed;
  particle.energy *= 0.99;

  if (Math.floor(particle.pos) >= leds.length) {
    particle.pos = 0;
    particle.energy = Math.random()+0.10;
    particle.speed = delta*10*Math.random()+0.1;
    particle.color = Math.random();
  }

  const indexFloor = Math.floor(particle.pos);
  const indexCeil = Math.ceil(particle.pos);
  const floorEnergy = indexCeil - particle.pos;
  const ceilEnergy = 1 - floorEnergy;

  const rm = clamp(particle.energy, 0, 0.3)*3;
  const gm = clamp(particle.energy - 0.3, 0, 0.3)*3;
  const bm = clamp(particle.energy - 0.6, 0, 0.3)*3;

  const index = Math.round(particle.pos);
  const max_brightness = 255/2;
  console.log(max_brightness);
  leds[indexFloor].r += max_brightness * floorEnergy * rm;
  leds[indexFloor].g += max_brightness * floorEnergy * gm;
  leds[indexFloor].b += max_brightness * floorEnergy * bm;
  if (indexCeil < leds.length) {
    leds[indexCeil].r += max_brightness * ceilEnergy * rm;
    leds[indexCeil].g += max_brightness * ceilEnergy * gm;
    leds[indexCeil].b += max_brightness * ceilEnergy * bm;
  }
  console.log(leds.particles[0]);
}
