const canvas = document.querySelector("#previewCanvas");
const context = canvas.getContext("2d");
const codeEditor = document.querySelector("#codeEditor");
const codeStatus = document.querySelector("#codeStatus");
const intervalSelect = document.querySelector("#intervalSelect");
const toggleRunButton = document.querySelector("#toggleRunButton");
const toggleIndexesButton = document.querySelector("#toggleIndexesButton");
const clearButton = document.querySelector("#clearButton");
const ledCount = document.querySelector("#ledCount");
const ledList = document.querySelector("#ledList");
const placementHint = document.querySelector("#placementHint");

const box = {
  width: 12,
  depth: 12,
  height: 12,
};

const target = {
  x: box.width / 2,
  y: box.depth / 2,
  z: box.height / 2,
};

const leds = [];
let compiledAnimation = null;
let timerId = null;
let iteration = 0;
let animationStartedAt = performance.now();
let previousTickAt = animationStartedAt;
let yaw = -0.78;
let pitch = 0.58;
let isRotating = false;
let lastPointer = null;
let hoverFloorPoint = null;
let selectedFloorPoint = null;
let selectedHeight = 0;
let showLedIndexes = false;
let renderedLedListLength = -1;

const defaultCode = `// Mutate leds every interval tick.
// Each LED has { x, y, z, r, g, b }.

for (const led of leds) {
  const wave = time * 4 + led.x * 0.55 + led.y * 0.3 + led.z * 0.9;
  const pulse = Math.sin(wave) * 0.5 + 0.5;

  led.r = 32 + pulse * 223;
  led.g = 80 + (1 - pulse) * 120;
  led.b = 255 - pulse * 180;
}`;

codeEditor.value = defaultCode;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapToGrid(value, min, max) {
  return clamp(Math.round(value), min, max);
}

function snapPointToGrid(point) {
  return {
    x: snapToGrid(point.x, 0, box.width),
    y: snapToGrid(point.y, 0, box.depth),
    z: snapToGrid(point.z, 0, box.height),
  };
}

function rgb(r, g, b) {
  return { r, g, b };
}

function normalizeLedColors() {
  for (const led of leds) {
    led.r = clamp(Number.isFinite(Number(led.r)) ? Number(led.r) : 0, 0, 255);
    led.g = clamp(Number.isFinite(Number(led.g)) ? Number(led.g) : 0, 0, 255);
    led.b = clamp(Number.isFinite(Number(led.b)) ? Number(led.b) : 0, 0, 255);
  }
}

function setStatus(message, type) {
  codeStatus.textContent = message;
  codeStatus.className = `status ${type === "error" ? "status-error" : "status-ok"}`;
  codeEditor.classList.toggle("has-error", type === "error");
}

function compileAnimation() {
  try {
    compiledAnimation = new Function(
      "leds",
      "time",
      "iteration",
      "delta",
      "clamp",
      "rgb",
      "window",
      "document",
      "globalThis",
      "Function",
      `"use strict";\n${codeEditor.value}\n//# sourceURL=user-animation.js`,
    );
    setStatus("Code is valid.", "ok");
    return true;
  } catch (error) {
    compiledAnimation = null;
    setStatus(`Compile error: ${error.message}`, "error");
    return false;
  }
}

function startAnimation() {
  if (!compileAnimation()) {
    return;
  }

  stopAnimation(false);
  animationStartedAt = performance.now();
  previousTickAt = animationStartedAt;
  iteration = 0;
  timerId = window.setInterval(runAnimationIteration, Number(intervalSelect.value));
  toggleRunButton.textContent = "Stop";
  runAnimationIteration();
}

function stopAnimation(updateButton = true) {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }

  if (updateButton) {
    toggleRunButton.textContent = "Start";
  }
}

function runAnimationIteration() {
  if (!compiledAnimation) {
    return;
  }

  const now = performance.now();
  const time = (now - animationStartedAt) / 1000;
  const delta = (now - previousTickAt) / 1000;

  try {
    compiledAnimation(
      leds,
      time,
      iteration,
      delta,
      clamp,
      rgb,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    normalizeLedColors();
    previousTickAt = now;
    iteration += 1;
    setStatus(`Running. Iteration ${iteration}.`, "ok");
    render();
  } catch (error) {
    stopAnimation();
    setStatus(`Runtime error: ${error.message}`, "error");
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  render();
}

function vector(x, y, z) {
  return { x, y, z };
}

function subtract(a, b) {
  return vector(a.x - b.x, a.y - b.y, a.z - b.z);
}

function add(a, b) {
  return vector(a.x + b.x, a.y + b.y, a.z + b.z);
}

function scaleVector(point, amount) {
  return vector(point.x * amount, point.y * amount, point.z * amount);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return vector(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function normalize(point) {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return scaleVector(point, 1 / length);
}

function getCameraBasis() {
  const cameraDirection = normalize(
    vector(Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)),
  );
  const forward = scaleVector(cameraDirection, -1);
  const right = normalize(cross(vector(0, 0, 1), forward));
  const up = normalize(cross(forward, right));

  return { forward, right, up };
}

function getSceneMetrics() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / 18, rect.height / 16);

  return {
    width: rect.width,
    height: rect.height,
    centerX: rect.width / 2,
    centerY: rect.height / 2,
    scale,
  };
}

function projectPoint(point) {
  const { right, up, forward } = getCameraBasis();
  const metrics = getSceneMetrics();
  const relative = subtract(point, target);

  return {
    x: metrics.centerX + dot(relative, right) * metrics.scale,
    y: metrics.centerY - dot(relative, up) * metrics.scale,
    depth: dot(relative, forward),
  };
}

function screenToFloor(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const metrics = getSceneMetrics();
  const { right, up, forward } = getCameraBasis();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const worldPlanePoint = add(
    add(target, scaleVector(right, (screenX - metrics.centerX) / metrics.scale)),
    scaleVector(up, -(screenY - metrics.centerY) / metrics.scale),
  );

  if (Math.abs(forward.z) < 0.0001) {
    return null;
  }

  const t = -worldPlanePoint.z / forward.z;
  const floorPoint = add(worldPlanePoint, scaleVector(forward, t));

  if (
    floorPoint.x < 0 ||
    floorPoint.x > box.width ||
    floorPoint.y < 0 ||
    floorPoint.y > box.depth
  ) {
    return null;
  }

  return snapPointToGrid({
    x: floorPoint.x,
    y: floorPoint.y,
    z: 0,
  });
}

function heightFromScreen(clientX, clientY, floorPoint) {
  const rect = canvas.getBoundingClientRect();
  const mouse = {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
  const bottom = projectPoint({ ...floorPoint, z: 0 });
  const top = projectPoint({ ...floorPoint, z: box.height });
  const segment = {
    x: top.x - bottom.x,
    y: top.y - bottom.y,
  };
  const lengthSquared = segment.x * segment.x + segment.y * segment.y || 1;
  const amount = clamp(
    ((mouse.x - bottom.x) * segment.x + (mouse.y - bottom.y) * segment.y) / lengthSquared,
    0,
    1,
  );

  return snapToGrid(amount * box.height, 0, box.height);
}

function boxCorners() {
  return [
    vector(0, 0, 0),
    vector(box.width, 0, 0),
    vector(box.width, box.depth, 0),
    vector(0, box.depth, 0),
    vector(0, 0, box.height),
    vector(box.width, 0, box.height),
    vector(box.width, box.depth, box.height),
    vector(0, box.depth, box.height),
  ];
}

function drawLine(a, b, color, width = 1) {
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function drawCircle(point, radius, fill, stroke = null) {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();

  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1.5;
    context.stroke();
  }
}

function drawLedIndexLabel(screen, index) {
  const text = String(index);
  const x = screen.x + 10;
  const y = screen.y - 10;
  const paddingX = 5;
  const paddingY = 3;

  context.save();
  context.font = "700 12px Inter, ui-sans-serif, system-ui, sans-serif";
  context.textBaseline = "middle";

  const width = context.measureText(text).width + paddingX * 2;
  const height = 18;

  context.fillStyle = "rgba(2, 6, 23, 0.82)";
  context.strokeStyle = "rgba(226, 232, 240, 0.55)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x, y - height / 2, width, height, 5);
  context.fill();
  context.stroke();

  context.fillStyle = "#f8fafc";
  context.fillText(text, x + paddingX, y + paddingY - 1);
  context.restore();
}

function drawBox() {
  const corners = boxCorners().map(projectPoint);
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  for (const [start, end] of edges) {
    const depth = (corners[start].depth + corners[end].depth) / 2;
    const alpha = clamp(0.42 + depth * 0.045, 0.2, 0.85);
    drawLine(corners[start], corners[end], `rgba(148, 163, 184, ${alpha})`, 1.2);
  }

  drawLine(projectPoint(vector(0, 0, 0)), projectPoint(vector(box.width, 0, 0)), "#ef4444", 2);
  drawLine(projectPoint(vector(0, 0, 0)), projectPoint(vector(0, box.depth, 0)), "#22c55e", 2);
  drawLine(projectPoint(vector(0, 0, 0)), projectPoint(vector(0, 0, box.height)), "#60a5fa", 2);
}

function drawFloorGrid() {
  for (let x = 1; x < box.width; x += 1) {
    drawLine(
      projectPoint(vector(x, 0, 0)),
      projectPoint(vector(x, box.depth, 0)),
      "rgba(96, 165, 250, 0.1)",
    );
  }

  for (let y = 1; y < box.depth; y += 1) {
    drawLine(
      projectPoint(vector(0, y, 0)),
      projectPoint(vector(box.width, y, 0)),
      "rgba(96, 165, 250, 0.1)",
    );
  }
}

function drawFloorPointGuides(point) {
  const floorPoint = projectPoint(point);
  const xStart = projectPoint(vector(point.x, 0, 0));
  const xEnd = projectPoint(vector(point.x, box.depth, 0));
  const yStart = projectPoint(vector(0, point.y, 0));
  const yEnd = projectPoint(vector(box.width, point.y, 0));

  drawLine(xStart, xEnd, "rgba(97, 218, 251, 0.75)", 2);
  drawLine(yStart, yEnd, "rgba(97, 218, 251, 0.75)", 2);
  drawLine(projectPoint(vector(point.x, 0, 0)), floorPoint, "rgba(34, 197, 94, 0.9)", 3);
  drawLine(projectPoint(vector(0, point.y, 0)), floorPoint, "rgba(239, 68, 68, 0.9)", 3);
}

function drawLeds() {
  const projected = leds
    .map((led, index) => ({
      led,
      index,
      screen: projectPoint(led),
    }))
    .sort((a, b) => a.screen.depth - b.screen.depth);

  for (const { led, screen, index } of projected) {
    const brightness = clamp((led.r + led.g + led.b) / (255 * 3), 0, 1);
    const color = `rgb(${Math.round(led.r)}, ${Math.round(led.g)}, ${Math.round(led.b)})`;

    context.save();
    context.shadowColor = color;
    context.shadowBlur = 8 + brightness * 16;
    drawCircle(screen, 4.5 + brightness * 3.5, color, "rgba(255, 255, 255, 0.72)");
    context.restore();
  }

  for (const { screen, index } of projected) {
    if (showLedIndexes) {
      drawLedIndexLabel(screen, index);
    }
  }
}

function drawPlacementMarkers() {
  if (selectedFloorPoint) {
    const bottom = projectPoint(selectedFloorPoint);
    const selectedPoint = projectPoint({ ...selectedFloorPoint, z: selectedHeight });

    drawLine(bottom, projectPoint({ ...selectedFloorPoint, z: box.height }), "rgba(251, 191, 36, 0.58)", 2);
    drawCircle(bottom, 5, "rgba(251, 191, 36, 0.24)", "rgba(251, 191, 36, 0.95)");
    drawCircle(selectedPoint, 7, "rgba(251, 191, 36, 0.9)", "rgba(255, 255, 255, 0.9)");
    return;
  }

  if (hoverFloorPoint) {
    drawFloorPointGuides(hoverFloorPoint);
    drawCircle(projectPoint(hoverFloorPoint), 6, "rgba(97, 218, 251, 0.55)", "rgba(255, 255, 255, 0.86)");
  }
}

function render() {
  const metrics = getSceneMetrics();
  context.clearRect(0, 0, metrics.width, metrics.height);

  drawFloorGrid();
  drawBox();
  drawLeds();
  drawPlacementMarkers();

  ledCount.textContent = `${leds.length} LED${leds.length === 1 ? "" : "s"}`;
  renderLedList();
}

function renderLedList(force = false) {
  if (!force && renderedLedListLength === leds.length) {
    return;
  }

  renderedLedListLength = leds.length;
  ledList.replaceChildren();

  leds.forEach((_, index) => {
    const item = document.createElement("span");
    item.className = "led-list-item";

    const number = document.createElement("span");
    number.textContent = String(index);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-led-button";
    removeButton.type = "button";
    removeButton.dataset.ledIndex = String(index);
    removeButton.setAttribute("aria-label", `Remove LED ${index}`);
    removeButton.textContent = "×";

    item.append(number, removeButton);
    ledList.append(item);
  });
}

function addLed(point) {
  const snappedPoint = snapPointToGrid(point);

  leds.push({
    x: snappedPoint.x,
    y: snappedPoint.y,
    z: snappedPoint.z,
    r: 255,
    g: 180,
    b: 80,
  });
  render();
}

function handlePointerMove(event) {
  if (isRotating && lastPointer) {
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;

    yaw += dx * 0.01;
    pitch = clamp(pitch - dy * 0.01, -0.05, 1.25);
    lastPointer = { x: event.clientX, y: event.clientY };
    render();
    return;
  }

  if (selectedFloorPoint) {
    selectedHeight = heightFromScreen(event.clientX, event.clientY, selectedFloorPoint);
    placementHint.textContent = `Select height: z=${selectedHeight}. Left-click to add LED.`;
    render();
    return;
  }

  hoverFloorPoint = screenToFloor(event.clientX, event.clientY);
  placementHint.textContent = hoverFloorPoint
    ? `Floor position: x=${hoverFloorPoint.x}, y=${hoverFloorPoint.y}. Left-click to lock.`
    : "Hover over the floor to place an LED on the 12×12×12 grid.";
  render();
}

function handlePointerDown(event) {
  if (event.button === 2) {
    isRotating = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    return;
  }

  if (event.button !== 0) {
    return;
  }

  if (selectedFloorPoint) {
    addLed({ ...selectedFloorPoint, z: selectedHeight });
    selectedFloorPoint = null;
    selectedHeight = 0;
    placementHint.textContent = "LED added. Hover over the floor to place another grid-snapped LED.";
    return;
  }

  const floorPoint = screenToFloor(event.clientX, event.clientY);
  if (floorPoint) {
    selectedFloorPoint = floorPoint;
    selectedHeight = heightFromScreen(event.clientX, event.clientY, selectedFloorPoint);
    placementHint.textContent = "XY locked. Move vertically, then left-click to add LED.";
    render();
  }
}

function handlePointerUp(event) {
  if (event.button === 2) {
    isRotating = false;
    lastPointer = null;
    canvas.style.cursor = "crosshair";

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }
}

let compileDebounceId = null;
codeEditor.addEventListener("input", () => {
  window.clearTimeout(compileDebounceId);
  compileDebounceId = window.setTimeout(() => {
    compileAnimation();
    if (timerId !== null && compiledAnimation) {
      setStatus("Code updated. Running next interval.", "ok");
    }
  }, 250);
});

codeEditor.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") {
    return;
  }

  event.preventDefault();

  if (!document.execCommand("insertText", false, "  ")) {
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;

    codeEditor.setRangeText("  ", start, end, "end");
    codeEditor.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

toggleRunButton.addEventListener("click", () => {
  if (timerId === null) {
    startAnimation();
  } else {
    stopAnimation();
    setStatus("Stopped.", "ok");
  }
});

intervalSelect.addEventListener("change", () => {
  if (timerId !== null) {
    stopAnimation(false);
    timerId = window.setInterval(runAnimationIteration, Number(intervalSelect.value));
    toggleRunButton.textContent = "Stop";
  }
});

clearButton.addEventListener("click", () => {
  leds.length = 0;
  selectedFloorPoint = null;
  hoverFloorPoint = null;
  renderLedList(true);
  render();
});

ledList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const removeButton = event.target.closest(".remove-led-button");

  if (!removeButton) {
    return;
  }

  const index = Number(removeButton.dataset.ledIndex);

  if (!Number.isInteger(index) || index < 0 || index >= leds.length) {
    return;
  }

  leds.splice(index, 1);
  renderLedList(true);
  render();
});

toggleIndexesButton.addEventListener("click", () => {
  showLedIndexes = !showLedIndexes;
  toggleIndexesButton.textContent = showLedIndexes ? "Hide Indexes" : "Show Indexes";
  toggleIndexesButton.classList.toggle("is-active", showLedIndexes);
  toggleIndexesButton.setAttribute("aria-pressed", String(showLedIndexes));
  render();
});

canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointerleave", () => {
  if (!isRotating && !selectedFloorPoint) {
    hoverFloorPoint = null;
    placementHint.textContent = "Hover over the floor to place an LED on the 12×12×12 grid.";
    render();
  }
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("resize", resizeCanvas);

compileAnimation();
resizeCanvas();
