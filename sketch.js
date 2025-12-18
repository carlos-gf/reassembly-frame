let srcImg = null;
let srcSquare = null;
let ready = false;

let stripeCount = 20;
let minStripes = 0;
let maxStripes = 80;

let toBW = false;
let rotSteps = 3;

let ui;          // overlay container
let fileInput;   // visible, reliable on iPad
let bwBtn, rotBtn, saveBtn, minusBtn, plusBtn;

let cachedG = null;
let dirty = true;

// Controls memory. Bigger = sharper, but heavier.
// 1024–1600 is a good range for iPad + browser stability.
const MAX_WORKING_SIZE = 1400;

function setup() {
  createCanvas(900, 900);
  pixelDensity(1);

  // Make sure canvas is behind UI
  const c = document.querySelector('canvas');
  c.style.position = 'relative';
  c.style.zIndex = '0';

  setupUI();

  cachedG = createGraphics(width, height);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(255);

  if (!ready) {
    fill(20);
    textSize(16);
    text("Use the controls in the top right to load an image", width / 2, height / 2);
    drawHUD();
    return;
  }

  ensureRendered();
  image(cachedG, 0, 0);

  drawHUD();
}

/* ---------------- UI ---------------- */

function setupUI() {
  ui = createDiv();
  ui.style('position', 'fixed');
  ui.style('top', '12px');
  ui.style('right', '12px');
  ui.style('z-index', '9999');
  ui.style('display', 'flex');
  ui.style('gap', '8px');
  ui.style('align-items', 'center');
  ui.style('background', 'rgba(255,255,255,0.85)');
  ui.style('padding', '8px 10px');
  ui.style('border', '1px solid #000');
  ui.style('border-radius', '10px');
  ui.style('backdrop-filter', 'blur(6px)');

  // Visible file input = most reliable on iPad Safari
  fileInput = createFileInput(handleFile);
  fileInput.parent(ui);
  fileInput.attribute('accept', 'image/*');
  styleControl(fileInput);
  fileInput.style('max-width', '160px');

  minusBtn = createButton('−');
  minusBtn.parent(ui);
  styleControl(minusBtn);

  plusBtn = createButton('+');
  plusBtn.parent(ui);
  styleControl(plusBtn);

  bwBtn = createButton('B/W');
  bwBtn.parent(ui);
  styleControl(bwBtn);

  rotBtn = createButton('Rotate');
  rotBtn.parent(ui);
  styleControl(rotBtn);

  saveBtn = createButton('Save');
  saveBtn.parent(ui);
  styleControl(saveBtn);

  minusBtn.mousePressed(() => {
    if (!ready) return;
    stripeCount = Math.max(minStripes, stripeCount - 2);
    if (stripeCount > 0) stripeCount = Math.floor(stripeCount / 2) * 2;
    markDirty();
  });

  plusBtn.mousePressed(() => {
    if (!ready) return;
    stripeCount = Math.min(maxStripes, stripeCount + 2);
    if (stripeCount > 0) stripeCount = Math.floor(stripeCount / 2) * 2;
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
    saveCanvas(cachedG, `result_${stamp()}_div${stripeCount}${toBW ? "_bw" : ""}_rot${rotSteps * 90}`, 'png');
  });
}

function styleControl(el) {
  el.style('font-size', '14px');
  el.style('padding', '8px 10px');
  el.style('border', '1px solid #000');
  el.style('background', '#fff');
  el.style('border-radius', '8px');
  el.style('cursor', 'pointer');
  el.style('pointer-events', 'auto');
}

/* ---------------- Memory safe image load ---------------- */

function handleFile(file) {
  if (!file || file.type !== 'image') return;

  loadImage(file.data, img => {
    srcImg = img;

    // Crop to centered square
    let sq = cropCenterSquare(srcImg);

    // Downscale to reduce memory + avoid browser reloads
    if (sq.width > MAX_WORKING_SIZE) {
      sq.resize(MAX_WORKING_SIZE, MAX_WORKING_SIZE);
    }

    srcSquare = sq;

    // Reset state
    rotSteps = 3;
    stripeCount = 20;
    toBW = false;

    ready = true;
    markDirty();
  });
}

/* ---------------- Render caching ---------------- */

function markDirty() {
  dirty = true;
}

function ensureRendered() {
  if (!dirty) return;
  cachedG = runPipeline(); // only re-render on changes
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

/* ---------------- Helpers ---------------- */

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
  const stripeW = Math.max(1, Math.floor(w / nStripes));
  const count = Math.ceil(w / stripeW);
  const order = alternatingEndsOrder(count);
  const out = createGraphics(w, h);
  out.background(255);
  let dstX = 0;
  for (let i = 0; i < count; i++) {
    const srcX = order[i] * stripeW;
    const sw = Math.min(stripeW, w - srcX);
    out.copy(srcG, srcX, 0, sw, h, dstX, 0, sw, h);
    dstX += sw;
    if (dstX >= w) break;
  }
  return out;
}

function reorderHorizontalStripes(srcG, nStripes) {
  const w = srcG.width, h = srcG.height;
  const stripeH = Math.max(1, Math.floor(h / nStripes));
  const count = Math.ceil(h / stripeH);
  const order = alternatingEndsOrder(count);
  const out = createGraphics(w, h);
  out.background(255);
  let dstY = 0;
  for (let i = 0; i < count; i++) {
    const srcY = order[i] * stripeH;
    const sh = Math.min(stripeH, h - srcY);
    out.copy(srcG, 0, srcY, w, sh, 0, dstY, w, sh);
    dstY += sh;
    if (dstY >= h) break;
  }
  return out;
}

function drawHUD() {
  push();
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(12);
  const bw = toBW ? "ON" : "OFF";
  text(`Div: ${stripeCount} | B/W: ${bw} | Rot: ${rotSteps * 90}°`, 12, height - 22);
  pop();
}
