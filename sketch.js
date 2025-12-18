let srcImgFull = null;   // full image for Color mode
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
let rotSteps = 0; // user rotation only (0..3)

// UI
let container, uiWrap, controlsRow;
let fileInput, bwBtn, rotBtn, saveBtn, minusBtn, plusBtn;
let divLabel;
let tabRow, tabLensBtn, tabColorBtn;

// Lens render cache
let cachedG = null;
let dirty = true;

// Performance
const MAX_WORKING_SIZE = 1600;

// Color animation
let colorFrameIndex = 0;
let lastFrameMs = 0;
const frameIntervalMs = 180;

/* ---------------- Setup ---------------- */

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

  document.querySelector('canvas').style.touchAction = 'none';
  textAlign(CENTER, CENTER);
}

function draw() {
  if (!ready) {
    drawPlaceholder();
    return;
  }

  background(255);

  // COLOR MODE — always redraw (animated)
  if (mode === MODE_COLOR) {
    updateColorAnimation();
    const g = renderColorAnimatedFrame();
    image(g, 0, 0);
    return;
  }

  // LENS MODE — cached
  ensureRendered();
  image(cachedG, 0, 0);
}

function windowResized() {
  applyResponsiveLayout();
  markDirty();
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

  bwBtn.mousePressed(() => { toBW = !toBW; markDirty(); });
  rotBtn.mousePressed(() => { rotSteps = (rotSteps + 1) % 4; markDirty(); });
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
}

/* ---------------- State ---------------- */

function setMode(m) {
  mode = m;
  updateTabStyles();
  updateLabel();
  lastFrameMs = 0;
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
    markDirty();
  } else {
    colorFrames = Math.max(COLOR_MIN, Math.min(COLOR_MAX, colorFrames + dir));
    colorFrameIndex = 0;
    lastFrameMs = 0;
  }

  updateLabel();
}

function updateLabel() {
  if (mode === MODE_LENS) {
    if (lensDivisions === 0) divLabel.html('Divisions: 0 (original)');
    else if (lensDivisions === 2) divLabel.html('Divisions: 2 (mirrored)');
    else divLabel.html(`Divisions: ${lensDivisions}`);
  } else {
    divLabel.html(`Frames: ${colorFrames} × ${colorFrames}`);
  }
}

function normalizeLensDivisions(n) {
  if (n <= 0) return 0;
  return Math.floor(n / 2) * 2;
}

/* ---------------- Image loading ---------------- */

function handleFile(file) {
  if (!file || file.type !== 'image') return;

  loadImage(file.data, img => {
    srcImgFull = downscaleIfNeeded(img, MAX_WORKING_SIZE);
    srcSquare = cropCenterSquare(img);
    srcSquare = downscaleIfNeeded(srcSquare, MAX_WORKING_SIZE);

    lensDivisions = 20;
    colorFrames = 20;
    rotSteps = 0;
    toBW = false;

    colorFrameIndex = 0;
    lastFrameMs = 0;

    ready = true;
    updateLabel();
    markDirty();
  });
}

/* ---------------- Rendering ---------------- */

function ensureRendered() {
  if (!dirty) return;
  cachedG = renderLens();
  cachedG.noSmooth();
  dirty = false;
}

function renderLens() {
  let img = applyUserTransforms(srcSquare);

  if (lensDivisions === 0) return renderCentered(img);
  if (lensDivisions === 2) return renderMirrored(img);

  const mirrored = renderMirrored(img);
  const v = reorderVerticalStripes(mirrored, lensDivisions);
  return reorderHorizontalStripes(v, lensDivisions);
}

/* ---------------- Color animation ---------------- */

function updateColorAnimation() {
  const now = millis();
  if (now - lastFrameMs >= frameIntervalMs) {
    lastFrameMs = now;
    colorFrameIndex = (colorFrameIndex + 1) % colorFrames;
  }
}

function renderColorAnimatedFrame() {
  let img = applyUserTransforms(srcImgFull);

  // frames == columns (square sampling grid)
  const gridN = Math.max(COLOR_MIN, Math.min(COLOR_MAX, colorFrames));
  const bands = buildColorBands(img, gridN); // returns gridN frames each with gridN columns
  const colors = bands[colorFrameIndex];

  const g = createGraphics(width, height);
  g.noSmooth();
  g.background(255);

  const n = colors.length;
  const stripeW = width / n;

  g.noStroke();
  for (let i = 0; i < n; i++) {
    const c = colors[i];
    g.fill(c[0], c[1], c[2]);
    g.rect(i * stripeW, 0, stripeW + 1, height);
  }
  return g;
}

/* ---------------- Utilities ---------------- */

function applyUserTransforms(img) {
  let out = img;
  if (rotSteps !== 0) out = rotateAnyBySteps(out, rotSteps);
  if (toBW) out = toGrayscale(out);
  return out;
}

function rotateAnyBySteps(img, steps) {
  steps = ((steps % 4) + 4) % 4;
  if (steps === 0) return img;

  const w = img.width;
  const h = img.height;
  const ow = steps % 2 ? h : w;
  const oh = steps % 2 ? w : h;

  const g = createGraphics(ow, oh);
  g.noSmooth();
  g.translate(ow / 2, oh / 2);
  g.rotate(HALF_PI * steps);
  g.imageMode(CENTER);
  g.image(img, 0, 0);
  return g.get();
}

function toGrayscale(img) {
  const g = createGraphics(img.width, img.height);
  g.noSmooth();
  g.image(img, 0, 0);
  g.filter(GRAY);
  return g.get();
}

function downscaleIfNeeded(img, maxDim) {
  const m = Math.max(img.width, img.height);
  if (m <= maxDim) return img;
  const s = maxDim / m;
  const out = createImage(floor(img.width * s), floor(img.height * s));
  out.copy(img, 0, 0, img.width, img.height, 0, 0, out.width, out.height);
  return out;
}

function cropCenterSquare(img) {
  const s = min(img.width, img.height);
  const x = floor((img.width - s) / 2);
  const y = floor((img.height - s) / 2);
  const out = createImage(s, s);
  out.copy(img, x, y, s, s, 0, 0, s, s);
  return out;
}

function renderCentered(img) {
  const g = createGraphics(width, height);
  g.background(255);
  g.imageMode(CENTER);
  const s = min(width / img.width, height / img.height);
  g.image(img, width / 2, height / 2, img.width * s, img.height * s);
  return g;
}

function renderMirrored(img) {
  const qW = width / 2;
  const qH = height / 2;
  const fit = fitCenter(img, qW, qH);

  const g = createGraphics(width, height);
  g.background(255);
  g.image(fit, 0, 0);
  g.image(mirrorH(fit), qW, 0);
  g.image(mirrorV(fit), 0, qH);
  g.image(mirrorV(mirrorH(fit)), qW, qH);
  return g;
}

function fitCenter(img, w, h) {
  const g = createGraphics(w, h);
  g.background(255);
  g.imageMode(CENTER);
  const s = min(w / img.width, h / img.height);
  g.image(img, w / 2, h / 2, img.width * s, img.height * s);
  return g;
}

function mirrorH(img) {
  const g = createGraphics(img.width, img.height);
  g.translate(img.width, 0);
  g.scale(-1, 1);
  g.image(img, 0, 0);
  return g;
}

function mirrorV(img) {
  const g = createGraphics(img.width, img.height);
  g.translate(0, img.height);
  g.scale(1, -1);
  g.image(img, 0, 0);
  return g;
}

function alternatingEndsOrder(n) {
  const o = [];
  let l = 0, r = n - 1;
  while (l <= r) {
    o.push(l++);
    if (l <= r) o.push(r--);
  }
  return o;
}

function reorderVerticalStripes(src, n) {
  const g = createGraphics(src.width, src.height);
  g.background(255);
  let dx = 0;
  const o = alternatingEndsOrder(n);

  for (let i = 0; i < n; i++) {
    const id = o[i];
    const x0 = round(id * src.width / n);
    const x1 = round((id + 1) * src.width / n);
    const w = max(1, x1 - x0);
    g.copy(src, x0, 0, w, src.height, dx, 0, w, src.height);
    dx += w;
  }
  return g;
}

function reorderHorizontalStripes(src, n) {
  const g = createGraphics(src.width, src.height);
  g.background(255);
  let dy = 0;
  const o = alternatingEndsOrder(n);

  for (let i = 0; i < n; i++) {
    const id = o[i];
    const y0 = round(id * src.height / n);
    const y1 = round((id + 1) * src.height / n);
    const h = max(1, y1 - y0);
    g.copy(src, 0, y0, src.width, h, 0, dy, src.width, h);
    dy += h;
  }
  return g;
}

/*
  Color bands:
  frames = N, columns = N
  returns: Array(N) of Array(N) RGB triplets
*/
function buildColorBands(img, n) {
  const frames = n;
  const cols = n; // <-- THE FIX: columns match frames

  const out = [];
  img.loadPixels();

  for (let b = 0; b < frames; b++) {
    const y0 = floor(b * img.height / frames);
    const y1 = max(y0 + 1, floor((b + 1) * img.height / frames));
    const row = [];

    for (let c = 0; c < cols; c++) {
      const x0 = floor(c * img.width / cols);
      const x1 = max(x0 + 1, floor((c + 1) * img.width / cols));

      let r = 0, g = 0, bl = 0, cnt = 0;

      // Light subsampling for mobile friendliness
      const xStep = max(1, floor((x1 - x0) / 3));
      const yStep = max(1, floor((y1 - y0) / 3));

      for (let y = y0; y < y1; y += yStep) {
        for (let x = x0; x < x1; x += xStep) {
          const i = 4 * (y * img.width + x);
          r += img.pixels[i];
          g += img.pixels[i + 1];
          bl += img.pixels[i + 2];
          cnt++;
        }
      }

      row.push(cnt ? [r / cnt, g / cnt, bl / cnt] : [0, 0, 0]);
    }

    out.push(row);
  }

  return out;
}

function drawPlaceholder() {
  background(230);
  fill(120);
  noStroke();
  text('Choose an image', width / 2, height / 2);
}

function markDirty() {
  dirty = true;
}

function saveImage() {
  if (!ready) return;

  if (mode === MODE_LENS) {
    ensureRendered();
    saveCanvas(cachedG, 'reassembly_lens', 'png');
  } else {
    // Save the currently displayed color frame
    const g = renderColorAnimatedFrame();
    saveCanvas(g, 'reassembly_color', 'png');
  }
}
