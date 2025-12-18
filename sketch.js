let srcImg = null;
let srcSquare = null;
let ready = false;

let stripeCount = 20;
let minStripes = 0;
let maxStripes = 80;

let toBW = false;
let rotSteps = 3;

let container;      // wraps canvas + UI
let uiWrap;         // UI panel
let controlsRow;    // buttons row
let fileInput;
let bwBtn, rotBtn, saveBtn, minusBtn, plusBtn;
let divLabel;

let cachedG = null;
let dirty = true;

const MAX_WORKING_SIZE = 1400;

function setup() {
  createCanvas(900, 900);
  pixelDensity(1);

  setupPage();
  setupContainer();
  setupUI();

  applyResponsiveLayout();
  cachedG = createGraphics(width, height);

  textAlign(CENTER, CENTER);
}

function draw() {
  if (!ready) {
    background(240);
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

/* ---------------- Page + layout ---------------- */

function setupPage() {
  document.body.style.margin = '0';
  document.body.style.background = '#fff';
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
  container.style('justify-content', 'center');
  container.style('gap', '14px');

  // Move canvas into container
  const c = document.querySelector('canvas');
  container.elt.appendChild(c);
  c.style.display = 'block';
  c.style.margin = '0';
}

function applyResponsiveLayout() {
  const pad = 24;
  const isHorizontal = window.innerWidth >= window.innerHeight;

  // Reserve UI space depending on orientation
  let availW, availH, canvasSide;

  if (isHorizontal) {
    // UI to the right
    const uiW = 240; // fixed-ish panel width
    availW = window.innerWidth - pad * 2 - uiW - 14;
    availH = window.innerHeight - pad * 2;
    canvasSide = Math.max(320, Math.floor(Math.min(availW, availH)));

    container.style('flex-direction', 'row');
    uiWrap.style('width', `${uiW}px`);
    uiWrap.style('max-width', `${uiW}px`);
  } else {
    // UI under
    const uiH = 150; // reserved height under canvas
    availW = window.innerWidth - pad * 2;
    availH = window.innerHeight - pad * 2 - uiH - 14;
    canvasSide = Math.max(320, Math.floor(Math.min(availW, availH)));

    container.style('flex-direction', 'column');
    uiWrap.style('width', `${canvasSide}px`);
    uiWrap.style('max-width', `${canvasSide}px`);
  }

  resizeCanvas(canvasSide, canvasSide);
  cachedG = createGraphics(width, height);

  // keep UI elements aligned nicely
  uiWrap.style('box-sizing', 'border-box');
}

/* ---------------- UI ---------------- */

function setupUI() {
  uiWrap = createDiv();
  uiWrap.parent(container);
  uiWrap.style('display', 'flex');
  uiWrap.style('flex-direction', 'column');
  uiWrap.style('gap', '10px');
  uiWrap.style('align-items', 'center');

  controlsRow = createDiv();
  controlsRow.parent(uiWrap);
  controlsRow.style('display', 'flex');
  controlsRow.style('gap', '8px');
  controlsRow.style('align-items', 'center');
  controlsRow.style('justify-content', 'center');
  controlsRow.style('flex-wrap', 'wrap');

  // Visible file input is most reliable on iPad
  fileInput = createFileInput(handleFile);
  fileInput.parent(controlsRow);
  fileInput.attribute('accept', 'image/*');
  styleControl(fileInput);
  fileInput.style('max-width', '180px');

  minusBtn = createButton('−');
  minusBtn.parent(controlsRow);
  styleControl(minusBtn);

  plusBtn = createButton('+');
  plusBtn.parent(controlsRow);
  styleControl(plusBtn);

  bwBtn = createButton('B/W');
  bwBtn.parent(controlsRow);
  styleControl(bwBtn);

  rotBtn = createButton('Rotate');
  rotBtn.parent(controlsRow);
  styleControl(rotBtn);

  saveBtn = createButton('Save');
  saveBtn.parent(controlsRow);
  styleControl(saveBtn);

  divLabel = createDiv('');
  divLabel.parent(uiWrap);
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

function styleControl(el) {
  el.style('font-size', '14px');
  el.style('padding', '8px 10px');
  el.style('border', '1px solid #000');
  el.style('background', '#fff');
  el.style('border-radius', '0px'); // pointy corners
  el.style('cursor', 'pointer');
  el.style('pointer-events', 'auto');
}

function updateDivLabel() {
  const label = stripeCount <= 1 ? 'Divisions: 0 (mirrored only)' : `Divisions: ${stripeCount}`;
  divLabel.html(label);
}

function normalizeStripeCount(n) {
  if (n <= 1) return n;      // allow 0 or 1 as "no division"
  return Math.floor(n / 2) * 2; // force even
}

/* ---------------- Keyboard controls (kept) ---------------- */

function keyPressed() {
  // divisions
  if (keyCode === RIGHT_ARROW) {
    stripeCount = Math.min(maxStripes, stripeCount + 2);
    stripeCount = normalizeStripeCount(stripeCount);
    updateDivLabel();
    markDirty();
  }
  if (keyCode === LEFT_ARROW) {
    stripeCount = Math.max(minStripes, stripeCount - 2);
    stripeCount = normalizeStripeCount(stripeCount);
    updateDivLabel();
    markDirty();
  }
  if (keyCode === UP_ARROW) {
    stripeCount = Math.min(maxStripes, stripeCount + 10);
    stripeCount = normalizeStripeCount(stripeCount);
    updateDivLabel();
    markDirty();
  }
  if (keyCode === DOWN_ARROW) {
    stripeCount = Math.max(minStripes, stripeCount - 10);
    stripeCount = normalizeStripeCount(stripeCount);
    updateDivLabel();
    markDirty();
  }

  if (key === 'b' || key === 'B') {
    toBW = !toBW;
    markDirty();
  }

  if (key === 'r' || key === 'R') {
    rotSteps = (rotSteps + 1) % 4;
    markDirty();
  }

  if (key === 's' || key === 'S') {
    if (!ready) return;
    ensureRendered();
    saveCanvas(
      cachedG,
      `result_${stamp()}_div${stripeCount}${toBW ? "_bw" : ""}_rot${rotSteps * 90}`,
      'png'
    );
  }
}

/* ---------------- Placeholder ---------------- */

function drawPlaceholder() {
  noStroke();
  fill(220);
  rect(0, 0, width, height);

  fill(120);
  textSize(16);
  text("Choose an image using the file input", width / 2, height / 2);

  // thin border
  noFill();
  stroke(200);
  rect(0.5, 0.5, width - 1, height - 1);
}

/* ---------------- Image loading ---------------- */

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

/* ---------------- Rendering cache ---------------- */

function markDirty() {
  dirty = true;
}

function ensureRendered() {
  if (!dirty) return;
  cachedG = runPipeline();
  dirty = false;
}

/* ---------------- Pipeline ---------------- */

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

/* ---------------- Utilities ---------------- */

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
