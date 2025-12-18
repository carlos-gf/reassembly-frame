let srcImg = null;
let srcSquare = null;
let ready = false;

let stripeCount = 20;
let minStripes = 0;
let maxStripes = 80;

let toBW = false;
let rotSteps = 3;

let ui;
let fileInput;
let bwBtn, rotBtn, saveBtn, minusBtn, plusBtn;
let divLabel;

let cachedG = null;
let dirty = true;

const MAX_WORKING_SIZE = 1400;

function setup() {
  // Start with a reasonable canvas, then resize to fit viewport
  createCanvas(900, 900);
  pixelDensity(1);

  const c = document.querySelector('canvas');
  c.style.display = 'block';
  c.style.margin = '0 auto';
  c.style.position = 'relative';
  c.style.zIndex = '0';

  setupUI();
  applyCenteredLayout();

  cachedG = createGraphics(width, height);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(255);

  if (!ready) {
    fill(20);
    textSize(16);
    text("Load an image to begin", width / 2, height / 2);
    return;
  }

  ensureRendered();
  image(cachedG, 0, 0);

  // No HUD text inside canvas anymore (label lives under image in UI)
}

function windowResized() {
  applyCenteredLayout();
  markDirty();
}

function applyCenteredLayout() {
  // Compute a centered square canvas that fits the viewport above UI
  // We'll reserve space for UI bar under the canvas.
  const pad = 24;
  const uiHeight = 80; // approximate height of UI area
  const availW = window.innerWidth - pad * 2;
  const availH = window.innerHeight - pad * 2 - uiHeight;

  const side = Math.max(320, Math.floor(Math.min(availW, availH)));

  resizeCanvas(side, side);
  cachedG = createGraphics(width, height);

  // Center the whole UI block + canvas in the page
  document.body.style.margin = '0';
  document.body.style.background = '#fff';
  document.body.style.height = '100vh';
  document.body.style.display = 'flex';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';

  // Wrap canvas + UI in a centered column
  // p5 doesn’t create a wrapper automatically, so we position UI relative to viewport and center it
  ui.style('width', `${side}px`);
}

function setupUI() {
  ui = createDiv();
  ui.style('display', 'flex');
  ui.style('flex-direction', 'column');
  ui.style('align-items', 'center');
  ui.style('gap', '10px');

  // Attach to body (we will center body via flex in applyCenteredLayout)
  ui.parent(document.body);

  // Controls row
  const row = createDiv();
  row.parent(ui);
  row.style('display', 'flex');
  row.style('gap', '8px');
  row.style('align-items', 'center');
  row.style('justify-content', 'center');
  row.style('flex-wrap', 'wrap');

  fileInput = createFileInput(handleFile);
  fileInput.parent(row);
  fileInput.attribute('accept', 'image/*');
  styleControl(fileInput);
  fileInput.style('max-width', '180px');

  minusBtn = createButton('−');
  minusBtn.parent(row);
  styleControl(minusBtn);

  plusBtn = createButton('+');
  plusBtn.parent(row);
  styleControl(plusBtn);

  bwBtn = createButton('B/W');
  bwBtn.parent(row);
  styleControl(bwBtn);

  rotBtn = createButton('Rotate');
  rotBtn.parent(row);
  styleControl(rotBtn);

  saveBtn = createButton('Save');
  saveBtn.parent(row);
  styleControl(saveBtn);

  // Division label centered under the image
  divLabel = createDiv('');
  divLabel.parent(ui);
  divLabel.style('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
  divLabel.style('font-size', '13px');
  divLabel.style('color', '#000');
  divLabel.style('letter-spacing', '0.02em');
  divLabel.style('text-align', 'center');
  divLabel.style('user-select', 'none');
  updateDivLabel();

  minusBtn.mousePressed(() => {
    if (!ready) return;
    stripeCount = Math.max(minStripes, stripeCount - 2);
    stripeCount = normalizeStripeCount(stripeCount);
    updateDivLabel();
    markDirty();
  });

  plusBtn.mousePressed(() => {
    if (!ready) return;
    stripeCount = Math.min(maxStripes, stripeCount + 2);
    stripeCount = normalizeStripeCount(stripeCount);
    updateDivLabel();
    markDirty();
  });

  bwBtn.mousePressed(() => {
    if (!ready) return;
    toBW = !toBW;
    markDirty();
  });

  rotBtn.mousePressed(() => {
    if (!ready) return;
    rotSteps = (rotSteps + 1) % 4;
    markDirty();
  });

  saveBtn.mousePressed(() => {
    if (!ready) return;
    ensureRendered();
    saveCanvas(
      cachedG,
      `result_${stamp()}_div${stripeCount}${toBW ? "_bw" : ""}_rot${rotSteps * 90}`,
      'png'
    );
  });
}

function updateDivLabel() {
  const label = stripeCount <= 1 ? 'Divisions: 0 (mirrored only)' : `Divisions: ${stripeCount}`;
  divLabel.html(label);
}

function styleControl(el) {
  el.style('font-size', '14px');
  el.style('padding', '8px 10px');
  el.style('border', '1px solid #000');
  el.style('background', '#fff');
  el.style('border-radius', '10px');
  el.style('cursor', 'pointer');
  el.style('pointer-events', 'auto');
}

function normalizeStripeCount(n) {
  if (n <= 1) return n;
  return Math.floor(n / 2) * 2;
}

function handleFile(file) {
  if (!file || file.type !== 'image') return;

  loadImage(file.data, img => {
    srcImg = img;

    let sq = cropCenterSquare(srcImg);
    if (sq.width > MAX_WORKING_SIZE) {
      sq.resize(MAX_WORKING_SIZE, MAX_WORKING_SIZE);
    }
    srcSquare = sq;

    rotSteps = 3;
    stripeCount = 20;
    toBW = false;

    ready = true;
    updateDivLabel();
    markDirty();
  });
}

function markDirty() {
  dirty = true;
}

function ensureRendered() {
  if (!dirty) return;
  cachedG = runPipeline();
  dirty = false;
}

function runPipeline() {
  const qW = Math.floor(width / 2);
  const qH = Math.floor(height / 2);

  let oriented = rotateSquareBySteps(srcSquare, rotSteps);
  let fitted = fitCenter(oriented, qW, qH);
  if (toBW) fitted = toGrayscale(fitted);

  const tl = fitted;
  const tr = mirrorHorizontal(fitted);
  const bl = mirrorVertical(fitted);
  const br = mirrorVertical(tr);

  const base = createGraphics(width, height);
  base.background(255);
  base.image(tl, 0, 0);
  base.image(tr, qW, 0);
  base.image(bl, 0, qH);
  base.image(br, qW, qH);

  if (stripeCount <= 1) return base;

  const step1 = reorderVerticalStripes(base, stripeCount);
  const step2 = reorderHorizontalStripes(step1, stripeCount);
  return step2;
}

function stamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) + "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function cropCenterSquare(img) {
  const side = Math.min(img.width, img.height);
  const x = Math.floor((img.width - side) / 2);
  const y = Math.floor((img.height - side) / 2);
  const out = createImage(side, side);
  out.copy(img, x, y, side, side, 0, 0, side, side);
  return out;
}

function rotateSquareBySteps(img, steps) {
  steps = ((steps % 4) + 4) % 4;
  if (steps === 0) return img;

  const side = img.width;
  const g = createGraphics(side, side);
  g.background(255);
  g.push();
  g.translate(side / 2, side / 2);
  g.rotate(HALF_PI * steps);
  g.imageMode(CENTER);
  g.image(img, 0, 0);
  g.pop();
  return g.get();
}

function fitCenter(img, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const rw = Math.round(img.width * s);
  const rh = Math.round(img.height * s);
  const g = createGraphics(w, h);
  g.background(255);
  g.imageMode(CENTER);
  g.image(img, w / 2, h / 2, rw, rh);
  return g.get();
}

function toGrayscale(img) {
  const g = createGraphics(img.width, img.height);
  g.image(img, 0, 0);
  g.filter(GRAY);
  return g.get();
}

function mirrorHorizontal(img) {
  const g = createGraphics(img.width, img.height);
  g.push();
  g.translate(img.width, 0);
  g.scale(-1, 1);
  g.image(img, 0, 0);
  g.pop();
  return g.get();
}

function mirrorVertical(img) {
  const g = createGraphics(img.width, img.height);
  g.push();
  g.translate(0, img.height);
  g.scale(1, -1);
  g.image(img, 0, 0);
  g.pop();
  return g.get();
}

function alternatingEndsOrder(n) {
  const order = [];
  let left = 0, right = n - 1;
  while (left <= right) {
    if (left <= right) order.push(left++);
    if (left <= right) order.push(right--);
  }
  return order;
}

function reorderVerticalStripes(srcG, nStripes) {
  const w = srcG.width, h = srcG.height;
  const out = createGraphics(w, h);
  out.background(255);

  const order = alternatingEndsOrder(nStripes);

  let dstX = 0;
  for (let i = 0; i < nStripes; i++) {
    const idx = order[i];
    const x0 = Math.round((idx * w) / nStripes);
    const x1 = Math.round(((idx + 1) * w) / nStripes);
    const sw = Math.max(1, x1 - x0);

    out.copy(srcG, x0, 0, sw, h, dstX, 0, sw, h);
    dstX += sw;
  }
  return out;
}

function reorderHorizontalStripes(srcG, nStripes) {
  const w = srcG.width, h = srcG.height;
  const out = createGraphics(w, h);
  out.background(255);

  const order = alternatingEndsOrder(nStripes);

  let dstY = 0;
  for (let i = 0; i < nStripes; i++) {
    const idx = order[i];
    const y0 = Math.round((idx * h) / nStripes);
    const y1 = Math.round(((idx + 1) * h) / nStripes);
    const sh = Math.max(1, y1 - y0);

    out.copy(srcG, 0, y0, w, sh, 0, dstY, w, sh);
    dstY += sh;
  }
  return out;
}
