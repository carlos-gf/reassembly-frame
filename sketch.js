// Updated sketch.js
// Changes in this version:
// - Removed ALL pre rotation / conditional rotation hacks (no hidden rotations anywhere)
// - Kept user Rotate button (applies to both Lens + Color, visibly)
// - Color mode is now ANIMATED, uses the FULL image (no cropping)
// - Color + and - range is 1 to 80 (frames)
// - Animation speed is moderated (not too fast)

let srcImgFull = null;   // full image for Color mode (no crop)
let srcSquare = null;    // cropped square for Lens mode
let ready = false;

// Modes
const MODE_LENS = 'lens';
const MODE_COLOR = 'color';
let mode = MODE_LENS;

// Parameters
let lensDivisions = 20;  // 0,2,4...
let colorFrames = 20;    // 1..80

const LENS_MIN = 0;
const LENS_MAX = 80;

const COLOR_MIN = 1;
const COLOR_MAX = 80;

let toBW = false;
let rotSteps = 0; // user rotation only (0..3). Positive = CCW per p5 rotate convention.

// UI
let container, uiWrap, controlsRow;
let fileInput, bwBtn, rotBtn, saveBtn, minusBtn, plusBtn;
let divLabel;
let tabRow, tabLensBtn, tabColorBtn;

// Render cache
let cachedG = null;
let dirty = true;

// Performance
const MAX_WORKING_SIZE = 1600;

// Color animation
let colorFrameIndex = 0;
let lastFrameMs = 0;
let frameIntervalMs = 180; // not too fast
let colorBandsCache = null; // cached per (image, rotation, bw, frames)
let colorCacheKey = '';

function setup() {
  createCanvas(900, 900);
  pixelDensity(1);
  noSmooth();

  setupPage();
  setupContainer();
  setupUI();
  applyResponsiveLayout();

  cachedG = createGraphics(width, height);
  cachedG.noSmooth();

  const c = document.querySelector('canvas');
  c.style.touchAction = 'none';

  textAlign(CENTER, CENTER);
}

function draw() {
  if (!ready) {
    drawPlaceholder();
    return;
  }

  // Color mode animates even if nothing else changed
  if (mode === MODE_COLOR) {
    updateColorAnimation();
  }

  background(255);
  ensureRendered();
  image(cachedG, 0, 0);
}

function windowResized() {
  applyResponsiveLayout();
  markDirty(true);
}

/* ---------------- Layout ---------------- */

function setupPage() {
  document.body.style.margin = '0';
  document.body.style.height = '100vh';
  document.body.style.display = 'flex';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';
}

function setupContainer() {
  container = createDiv();
  container.parent(document.body);
  container.style('display', 'flex');
  container.style('align-items', 'center');
  container.style('gap', '14px');

  container.elt.appendChild(document.querySelector('canvas'));
}

function applyResponsiveLayout() {
  const isHorizontal = window.innerWidth >= window.innerHeight;
  const pad = 16;
  const gap = 14;

  let canvasSide;

  if (isHorizontal) {
    const uiW = Math.min(260, Math.floor(window.innerWidth * 0.32));
    canvasSide = Math.min(
      window.innerHeight - pad * 2,
      window.innerWidth - uiW - gap - pad * 2
    );
    container.style('flex-direction', 'row');
    uiWrap.style('width', uiW + 'px');
  } else {
    const uiH = 180;
    canvasSide = Math.min(
      window.innerWidth - pad * 2,
      window.innerHeight - uiH - gap - pad * 2
    );
    container.style('flex-direction', 'column');
    uiWrap.style('width', canvasSide + 'px');
  }

  canvasSide = Math.max(180, Math.floor(canvasSide));

  // avoid seams on 2×2 split
  if (canvasSide % 2 === 1) canvasSide -= 1;

  resizeCanvas(canvasSide, canvasSide);
  noSmooth();

  cachedG = createGraphics(width, height);
  cachedG.noSmooth();
}

/* ---------------- UI ---------------- */

function setupUI() {
  uiWrap = createDiv();
  uiWrap.parent(container);
  uiWrap.style('display', 'flex');
  uiWrap.style('flex-direction', 'column');
  uiWrap.style('gap', '10px');
  uiWrap.style('align-items', 'center');

  tabRow = createDiv();
  tabRow.parent(uiWrap);
  tabRow.style('display', 'flex');
  tabRow.style('gap', '8px');

  tabLensBtn = createButton('Lens');
  tabColorBtn = createButton('Color');
  tabLensBtn.parent(tabRow);
  tabColorBtn.parent(tabRow);
  styleControl(tabLensBtn);
  styleControl(tabColorBtn);

  tabLensBtn.mousePressed(() => setMode(MODE_LENS));
  tabColorBtn.mousePressed(() => setMode(MODE_COLOR));
  updateTabStyles();

  controlsRow = createDiv();
  controlsRow.parent(uiWrap);
  controlsRow.style('display', 'flex');
  controlsRow.style('gap', '8px');
  controlsRow.style('flex-wrap', 'wrap');
  controlsRow.style('justify-content', 'center');

  fileInput = createFileInput(handleFile);
  fileInput.parent(controlsRow);
  styleControl(fileInput);

  const stepper = createDiv();
  stepper.parent(controlsRow);
  stepper.style('display', 'flex');
  stepper.style('gap', '6px');

  minusBtn = createButton('−');
  plusBtn = createButton('+');
  minusBtn.parent(stepper);
  plusBtn.parent(stepper);
  styleControl(minusBtn);
  styleControl(plusBtn);

  bwBtn = createButton('B/W');
  rotBtn = createButton('Rotate');
  saveBtn = createButton('Save');

  bwBtn.parent(controlsRow);
  rotBtn.parent(controlsRow);
  saveBtn.parent(controlsRow);

  styleControl(bwBtn);
  styleControl(rotBtn);
  styleControl(saveBtn);

  divLabel = createDiv('');
  divLabel.parent(uiWrap);
  divLabel.style('font-size', '13px');

  minusBtn.mousePressed(() => stepValue(-1));
  plusBtn.mousePressed(() => stepValue(+1));

  bwBtn.mousePressed(() => {
    if (!ready) return;
    toBW = !toBW;
    markDirty(true);
  });

  rotBtn.mousePressed(() => {
    if (!ready) return;
    rotSteps = (rotSteps + 1) % 4;
    markDirty(true);
  });

  saveBtn.mousePressed(saveImage);

  updateLabel();
}

function styleControl(el) {
  el.style('border', '1px solid #000');
  el.style('background', '#fff');
  el.style('border-radius', '0');
  el.style('padding', '8px 10px');
  el.style('cursor', 'pointer');
  el.elt.style.touchAction = 'manipulation';
  el.elt.style.webkitTapHighlightColor = 'transparent';
  el.elt.style.userSelect = 'none';
}

function setMode(m) {
  mode = m;
  updateTabStyles();
  updateLabel();
  // When switching to Color, keep animation running smoothly
  if (mode === MODE_COLOR) {
    lastFrameMs = 0;
  }
  markDirty(false);
}

function updateTabStyles() {
  tabLensBtn.style('background', mode === MODE_LENS ? '#000' : '#fff');
  tabLensBtn.style('color', mode === MODE_LENS ? '#fff' : '#000');
  tabColorBtn.style('background', mode === MODE_COLOR ? '#000' : '#fff');
  tabColorBtn.style('color', mode === MODE_COLOR ? '#fff' : '#000');
}

function stepValue(dir) {
  if (!ready) return;

  if (mode === MODE_LENS) {
    lensDivisions = Math.max(LENS_MIN, Math.min(LENS_MAX, lensDivisions + dir * 2));
    lensDivisions = normalizeLensDivisions(lensDivisions);
  } else {
    colorFrames = Math.max(COLOR_MIN, Math.min(COLOR_MAX, colorFrames + dir));
    // reset animation index when changing frames
    colorFrameIndex = 0;
    lastFrameMs = 0;
  }

  updateLabel();
  markDirty(false);
}

function updateLabel() {
  if (mode === MODE_LENS) {
    if (lensDivisions === 0) divLabel.html('Divisions: 0 (original)');
    else if (lensDivisions === 2) divLabel.html('Divisions: 2 (mirrored)');
    else divLabel.html(`Divisions: ${lensDivisions}`);
  } else {
    divLabel.html(`Frames: ${colorFrames}`);
  }
}

function normalizeLensDivisions(n) {
  if (n <= 0) return 0;
  return Math.floor(n / 2) * 2;
}

/* ---------------- Keyboard controls (kept) ---------------- */

function keyPressed() {
  if (!ready) return;

  if (keyCode === LEFT_ARROW) stepValue(-1);
  if (keyCode === RIGHT_ARROW) stepValue(+1);

  if (key === 'b' || key === 'B') {
    toBW = !toBW;
    markDirty(true);
  }

  if (key === 'r' || key === 'R') {
    rotSteps = (rotSteps + 1) % 4;
    markDirty(true);
  }

  if (key === '1') setMode(MODE_LENS);
  if (key === '2') setMode(MODE_COLOR);

  if (key === 's' || key === 'S') saveImage();
}

/* ---------------- Image loading ---------------- */

function handleFile(file) {
  if (!file || file.type !== 'image') return;

  loadImage(file.data, img => {
    // Full image for Color mode (no crop)
    srcImgFull = downscaleIfNeeded(img, MAX_WORKING_SIZE);

    // Cropped square for Lens mode
    srcSquare = cropCenterSquare(img);
    srcSquare = downscaleIfNeeded(srcSquare, MAX_WORKING_SIZE);

    lensDivisions = 20;
    colorFrames = 20;
    rotSteps = 0;
    toBW = false;

    // Reset color animation + caches
    colorFrameIndex = 0;
    lastFrameMs = 0;
    colorBandsCache = null;
    colorCacheKey = '';

    ready = true;
    updateLabel();
    markDirty(true);
  });
}

/* ---------------- Rendering ---------------- */

function markDirty(resetCaches) {
  dirty = true;
  if (resetCaches) {
    // Any visual transform changes invalidate color cache
    colorBandsCache = null;
    colorCacheKey = '';
  }
}

function ensureRendered() {
  if (!dirty) return;
  cachedG = runPipeline();
  cachedG.noSmooth();
  dirty = false;
}

function runPipeline() {
  if (mode === MODE_COLOR) {
    return renderColorAnimatedFrame();
  }

  // Lens pipeline
  let img = srcSquare;

  // User rotation (visible) and optional BW applies to all lens states
  img = applyUserTransformsSquare(img);

  if (lensDivisions === 0) return renderCentered(img);
  if (lensDivisions === 2) return renderMirrored(img);

  const mirrored = renderMirrored(img);
  const step1 = reorderVerticalStripes(mirrored, lensDivisions);
  return reorderHorizontalStripes(step1, lensDivisions);
}

/* ---------------- Color animation ---------------- */

function updateColorAnimation() {
  const now = millis();
  if (now - lastFrameMs >= frameIntervalMs) {
    lastFrameMs = now;
    colorFrameIndex = (colorFrameIndex + 1) % Math.max(1, colorFrames);
    dirty = true; // force re-render for next frame
  }
}

function renderColorAnimatedFrame() {
  // Use FULL image (no crop). Apply user rotation and BW to the full image.
  let img = srcImgFull;
  img = applyUserTransformsAny(img);

  // Build or reuse cached band data for current settings
  const key = `${img.width}x${img.height}|rot${rotSteps}|bw${toBW ? 1 : 0}|frames${colorFrames}`;
  if (!colorBandsCache || colorCacheKey !== key) {
    colorBandsCache = buildColorBands(img, colorFrames);
    colorCacheKey = key;
    colorFrameIndex = 0;
    lastFrameMs = 0;
  }

  // Draw the current frame as a 1D “scan strip” expanded to the canvas:
  // each frame corresponds to one horizontal band of the image
  const colors = colorBandsCache[colorFrameIndex];

  const g = createGraphics(width, height);
  g.noSmooth();
  g.background(255);

  // layout: center the strip in a square canvas, but the strip fills the square
  // render as vertical stripes across the whole canvas
  const n = colors.length;
  const stripeW = width / n;

  g.noStroke();
  for (let i = 0; i < n; i++) {
    const c = colors[i];
    g.fill(c[0], c[1], c[2]);
    const x = i * stripeW;
    // +1 to reduce tiny gaps from rounding on some screens
    g.rect(x, 0, stripeW + 1, height);
  }

  return g;
}

// Build per-frame color data:
// frames = N (1..80)
// for each frame, sample a horizontal band of the image
// and compute average colors across X bins (columns)
function buildColorBands(img, frames) {
  const bands = Math.max(1, frames);

  // Number of vertical samples (stripes) in the abstraction.
  // Keep it stable and not too heavy for mobile.
  const sampleCols = Math.max(40, Math.min(220, Math.floor(img.width / 6)));

  const out = new Array(bands);

  // Work on pixels once
  img.loadPixels();
  const w = img.width;
  const h = img.height;
  const px = img.pixels;

  for (let b = 0; b < bands; b++) {
    const y0 = Math.floor((b * h) / bands);
    const y1 = Math.max(y0 + 1, Math.floor(((b + 1) * h) / bands));

    const row = new Array(sampleCols);

    for (let sx = 0; sx < sampleCols; sx++) {
      const x0 = Math.floor((sx * w) / sampleCols);
      const x1 = Math.max(x0 + 1, Math.floor(((sx + 1) * w) / sampleCols));

      let r = 0, g = 0, bl = 0, count = 0;

      // subsample for speed
      const xStep = Math.max(1, Math.floor((x1 - x0) / 4));
      const yStep = Math.max(1, Math.floor((y1 - y0) / 3));

      for (let y = y0; y < y1; y += yStep) {
        for (let x = x0; x < x1; x += xStep) {
          const idx = 4 * (y * w + x);
          r += px[idx + 0];
          g += px[idx + 1];
          bl += px[idx + 2];
          count++;
        }
      }

      if (count > 0) {
        r = r / count;
        g = g / count;
        bl = bl / count;
      }

      row[sx] = [r, g, bl];
    }

    out[b] = row;
  }

  return out;
}

/* ---------------- User transforms ---------------- */

function applyUserTransformsSquare(img) {
  let out = img;
  if (rotSteps !== 0) out = rotateAnyBySteps(out, rotSteps);
  if (toBW) out = toGrayscale(out);
  return out;
}

function applyUserTransformsAny(img) {
  let out = img;
  if (rotSteps !== 0) out = rotateAnyBySteps(out, rotSteps);
  if (toBW) out = toGrayscale(out);
  return out;
}

// Rotates any image (square or not) by steps of 90 degrees (CCW per step)
function rotateAnyBySteps(img, steps) {
  steps = ((steps % 4) + 4) % 4;
  if (steps === 0) return img;

  const w = img.width;
  const h = img.height;

  const outW = (steps % 2 === 1) ? h : w;
  const outH = (steps % 2 === 1) ? w : h;

  const g = createGraphics(outW, outH);
  g.noSmooth();
  g.background(255);
  g.push();
  g.translate(outW / 2, outH / 2);
  g.rotate(HALF_PI * steps);
  g.imageMode(CENTER);
  g.image(img, 0, 0);
  g.pop();
  return g.get();
}

/* ---------------- Lens render helpers ---------------- */

function renderCentered(img) {
  const g = createGraphics(width, height);
  g.noSmooth();
  g.background(255);
  g.imageMode(CENTER);
  const s = Math.min(width / img.width, height / img.height);
  g.image(img, width / 2, height / 2, img.width * s, img.height * s);
  return g;
}

function renderMirrored(img) {
  const qW = width / 2;
  const qH = height / 2;
  const fit = fitCenter(img, qW, qH);

  const g = createGraphics(width, height);
  g.noSmooth();
  g.background(255);

  g.image(fit, 0, 0);
  g.image(mirrorHorizontal(fit), qW, 0);
  g.image(mirrorVertical(fit), 0, qH);
  g.image(mirrorVertical(mirrorHorizontal(fit)), qW, qH);
  return g;
}

/* ---------------- Utilities ---------------- */

function downscaleIfNeeded(img, maxDim) {
  const w = img.width;
  const h = img.height;
  const m = Math.max(w, h);
  if (m <= maxDim) return img;

  const scale = maxDim / m;
  const nw = Math.floor(w * scale);
  const nh = Math.floor(h * scale);

  const out = createImage(nw, nh);
  out.copy(img, 0, 0, w, h, 0, 0, nw, nh);
  return out;
}

function cropCenterSquare(img) {
  const s = Math.min(img.width, img.height);
  const x = Math.floor((img.width - s) / 2);
  const y = Math.floor((img.height - s) / 2);
  const out = createImage(s, s);
  out.copy(img, x, y, s, s, 0, 0, s, s);
  return out;
}

function fitCenter(img, w, h) {
  const g = createGraphics(w, h);
  g.noSmooth();
  g.background(255);
  g.imageMode(CENTER);
  const s = Math.min(w / img.width, h / img.height);
  g.image(img, w / 2, h / 2, img.width * s, img.height * s);
  return g;
}

function toGrayscale(img) {
  const g = createGraphics(img.width, img.height);
  g.noSmooth();
  g.image(img, 0, 0);
  g.filter(GRAY);
  return g.get();
}

function mirrorHorizontal(img) {
  const g = createGraphics(img.width, img.height);
  g.noSmooth();
  g.push();
  g.translate(img.width, 0);
  g.scale(-1, 1);
  g.image(img, 0, 0);
  g.pop();
  return g;
}

function mirrorVertical(img) {
  const g = createGraphics(img.width, img.height);
  g.noSmooth();
  g.push();
  g.translate(0, img.height);
  g.scale(1, -1);
  g.image(img, 0, 0);
  g.pop();
  return g;
}

function alternatingEndsOrder(n) {
  const order = [];
  let l = 0, r = n - 1;
  while (l <= r) {
    if (l <= r) order.push(l++);
    if (l <= r) order.push(r--);
  }
  return order;
}

function reorderVerticalStripes(src, n) {
  const g = createGraphics(src.width, src.height);
  g.noSmooth();
  g.background(255);

  let dx = 0;
  const order = alternatingEndsOrder(n);

  for (let i = 0; i < n; i++) {
    const idx = order[i];
    const x0 = Math.round((idx * src.width) / n);
    const x1 = Math.round(((idx + 1) * src.width) / n);
    const w = Math.max(1, x1 - x0);
    g.copy(src, x0, 0, w, src.height, dx, 0, w, src.height);
    dx += w;
  }
  return g;
}

function reorderHorizontalStripes(src, n) {
  const g = createGraphics(src.width, src.height);
  g.noSmooth();
  g.background(255);

  let dy = 0;
  const order = alternatingEndsOrder(n);

  for (let i = 0; i < n; i++) {
    const idx = order[i];
    const y0 = Math.round((idx * src.height) / n);
    const y1 = Math.round(((idx + 1) * src.height) / n);
    const h = Math.max(1, y1 - y0);
    g.copy(src, 0, y0, src.width, h, 0, dy, src.width, h);
    dy += h;
  }
  return g;
}

/* ---------------- Placeholder + save ---------------- */

function drawPlaceholder() {
  background(230);
  fill(120);
  noStroke();
  text('Choose an image', width / 2, height / 2);
}

function ensureRendered() {
  if (!dirty) return;
  cachedG = runPipeline();
  cachedG.noSmooth();
  dirty = false;
}

function saveImage() {
  if (!ready) return;
  ensureRendered();
  saveCanvas(cachedG, 'reassembly', 'png');
}
