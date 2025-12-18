let srcSquare = null;
let ready = false;

// Modes
const MODE_LENS = 'lens';
const MODE_COLOR = 'color';
let mode = MODE_LENS;

// Parameters
let lensDivisions = 20; // 0,2,4...
let colorBands = 20;

const LENS_MIN = 0;
const LENS_MAX = 80;
const COLOR_MIN = 1;
const COLOR_MAX = 200;

let toBW = false;
let rotSteps = 0; // user rotation only (0–3)

let container, uiWrap, controlsRow;
let fileInput, bwBtn, rotBtn, saveBtn, minusBtn, plusBtn;
let divLabel;
let tabRow, tabLensBtn, tabColorBtn;

let cachedG = null;
let dirty = true;

const MAX_WORKING_SIZE = 1400;

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

  const c = document.querySelector('canvas');
  c.style.touchAction = 'none';

  textAlign(CENTER, CENTER);
}

function draw() {
  if (!ready) {
    drawPlaceholder();
    return;
  }

  background(255);
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

  minusBtn.mousePressed(() => stepDivisions(-1));
  plusBtn.mousePressed(() => stepDivisions(+1));
  bwBtn.mousePressed(() => { toBW = !toBW; markDirty(); });
  rotBtn.mousePressed(() => { rotSteps = (rotSteps + 1) % 4; markDirty(); });
  saveBtn.mousePressed(saveImage);

  updateDivLabel();
}

function styleControl(el) {
  el.style('border', '1px solid #000');
  el.style('background', '#fff');
  el.style('border-radius', '0');
  el.style('padding', '8px 10px');
  el.style('cursor', 'pointer');
  el.elt.style.touchAction = 'manipulation';
}

/* ---------------- Mode / Params ---------------- */

function setMode(m) {
  mode = m;
  updateTabStyles();
  updateDivLabel();
  markDirty();
}

function updateTabStyles() {
  tabLensBtn.style('background', mode === MODE_LENS ? '#000' : '#fff');
  tabLensBtn.style('color', mode === MODE_LENS ? '#fff' : '#000');
  tabColorBtn.style('background', mode === MODE_COLOR ? '#000' : '#fff');
  tabColorBtn.style('color', mode === MODE_COLOR ? '#fff' : '#000');
}

function stepDivisions(dir) {
  if (!ready) return;

  if (mode === MODE_LENS) {
    lensDivisions = Math.max(LENS_MIN, lensDivisions + dir * 2);
    lensDivisions = normalizeLensDivisions(lensDivisions);
  } else {
    colorBands = Math.max(COLOR_MIN, Math.min(COLOR_MAX, colorBands + dir));
  }
  updateDivLabel();
  markDirty();
}

function updateDivLabel() {
  if (mode === MODE_LENS) {
    if (lensDivisions === 0) divLabel.html('Divisions: 0 (original)');
    else if (lensDivisions === 2) divLabel.html('Divisions: 2 (mirrored)');
    else divLabel.html(`Divisions: ${lensDivisions}`);
  } else {
    divLabel.html(`Bands: ${colorBands}`);
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
    srcSquare = cropCenterSquare(img);
    if (srcSquare.width > MAX_WORKING_SIZE)
      srcSquare.resize(MAX_WORKING_SIZE, MAX_WORKING_SIZE);

    lensDivisions = 20;
    colorBands = 20;
    rotSteps = 0;
    toBW = false;
    ready = true;
    updateDivLabel();
    markDirty();
  });
}

/* ---------------- Rendering ---------------- */

function ensureRendered() {
  if (!dirty) return;
  cachedG = runPipeline();
  cachedG.noSmooth();
  dirty = false;
}

function runPipeline() {
  let img = srcSquare;

  // SINGLE rotation point (user only)
  if (rotSteps !== 0) img = rotateSquareBySteps(img, rotSteps);
  if (toBW) img = toGrayscale(img);

  if (mode === MODE_COLOR) return renderColorAbstraction(img, colorBands);

  if (lensDivisions === 0) return renderCentered(img);
  if (lensDivisions === 2) return renderMirrored(img);

  const mirrored = renderMirrored(img);
  const step1 = reorderVerticalStripes(mirrored, lensDivisions);
  return reorderHorizontalStripes(step1, lensDivisions);
}

/* ---------------- Render helpers ---------------- */

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
  g.image(fit, 0, 0);
  g.image(mirrorHorizontal(fit), qW, 0);
  g.image(mirrorVertical(fit), 0, qH);
  g.image(mirrorVertical(mirrorHorizontal(fit)), qW, qH);
  return g;
}

/* ---------------- Utilities ---------------- */

function rotateSquareBySteps(img, steps) {
  const side = img.width;
  const g = createGraphics(side, side);
  g.noSmooth();
  g.translate(side / 2, side / 2);
  g.rotate(HALF_PI * steps);
  g.imageMode(CENTER);
  g.image(img, 0, 0);
  return g;
}

function cropCenterSquare(img) {
  const s = Math.min(img.width, img.height);
  const x = (img.width - s) / 2;
  const y = (img.height - s) / 2;
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
  return g;
}

function mirrorHorizontal(img) {
  const g = createGraphics(img.width, img.height);
  g.noSmooth();
  g.translate(img.width, 0);
  g.scale(-1, 1);
  g.image(img, 0, 0);
  return g;
}

function mirrorVertical(img) {
  const g = createGraphics(img.width, img.height);
  g.noSmooth();
  g.translate(0, img.height);
  g.scale(1, -1);
  g.image(img, 0, 0);
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
  let dx = 0;
  const order = alternatingEndsOrder(n);

  for (let i = 0; i < n; i++) {
    const idx = order[i];
    const x0 = Math.round((idx * src.width) / n);
    const x1 = Math.round(((idx + 1) * src.width) / n);
    const w = x1 - x0;
    g.copy(src, x0, 0, w, src.height, dx, 0, w, src.height);
    dx += w;
  }
  return g;
}

function reorderHorizontalStripes(src, n) {
  const g = createGraphics(src.width, src.height);
  g.noSmooth();
  let dy = 0;
  const order = alternatingEndsOrder(n);

  for (let i = 0; i < n; i++) {
    const idx = order[i];
    const y0 = Math.round((idx * src.height) / n);
    const y1 = Math.round(((idx + 1) * src.height) / n);
    const h = y1 - y0;
    g.copy(src, 0, y0, src.width, h, 0, dy, src.width, h);
    dy += h;
  }
  return g;
}

function renderColorAbstraction(img, bands) {
  const g = createGraphics(width, height);
  g.noSmooth();
  g.background(255);

  const sample = createImage(400, 400);
  sample.copy(img, 0, 0, img.width, img.height, 0, 0, 400, 400);
  sample.loadPixels();

  const bandH = height / bands;
  for (let b = 0; b < bands; b++) {
    let r = 0, gg = 0, bb = 0, c = 0;
    const y0 = Math.floor((b * sample.height) / bands);
    const y1 = Math.floor(((b + 1) * sample.height) / bands);

    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < sample.width; x += 2) {
        const i = 4 * (y * sample.width + x);
        r += sample.pixels[i];
        gg += sample.pixels[i + 1];
        bb += sample.pixels[i + 2];
        c++;
      }
    }

    if (c > 0) g.fill(r / c, gg / c, bb / c);
    g.rect(0, b * bandH, width, bandH + 1);
  }
  return g;
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
  ensureRendered();
  saveCanvas(cachedG, 'reassembly_lens', 'png');
}
