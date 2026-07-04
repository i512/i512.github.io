# Addressable LED Animation Visualizer

A dependency-free static web app for previewing addressable LED animations in a 12×12×12 3D box.

## Run

Open `index.html` directly in a browser, or serve the folder with any static file server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Usage

- Write JavaScript in the editor. It runs on the selected interval when started.
- Mutate the available `leds` array. Each LED has `{ x, y, z, r, g, b }`.
- Hover over the preview floor to project the mouse onto the XY plane, snapped to the grid.
- Left-click once to lock XY, move the mouse to choose snapped Z, then left-click again to add the LED.
- Right-drag the preview to rotate the box.
- Use `Show Indexes` to overlay each LED's array index on the preview.
- Use the LED list at the bottom of the preview to remove individual LEDs.
- Compile and runtime errors are shown under the editor.
- Open `3d-approach.html` for a programmer-focused explanation of the 3D rendering approach.

## Demos

- `demos/fire.js` simulates fire for LEDs placed vertically in a row.
