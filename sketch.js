let srcImg = null;
let srcSquare = null;
let ready = false;

let stripeCount = 20;
let minStripes = 0;
let maxStripes = 80;

let toBW = false;
let rotSteps = 3;

let fileInput;
let loadBtn, bwBtn, rotBtn, saveBtn, divMinusBtn, divPlusBtn;

// caching
let cachedG = null;
let dirty = true;

function setup() {
  createCanvas(900, 900);
  pixelDensity(1);
  textAlign(CENTER, CENTER);

  // File input (hidden but used by the visible button)
  fileInput = createFileInput(handleFile);
  fileInput.position(0, 0);
  fileInput.style('opacity', '0');
  fileInput.style('width', '1px');
  fileInput.style('height', '1px');

  // Visible UI (works on iPad)
  loadBtn = createButton('Load');
  bwBtn = createButton('B/W');
  rotBtn = createButton('Rotate');
  saveBtn = createButton('Save');
  divMinusBtn = createButton('−');
  divPlusBtn = createButton('+');

  // Simple styling
  [loadBtn, bwBtn, rotBtn, saveBtn, divMinusBtn, divPlusBtn].forEach(b => {
    b.style('font-size', '14px');
    b.style('padding', '8px 10px');
    b.style('border', '1px solid #000');
    b.style('background', '#fff');
    b.style('border-radius', '6px');
  });

  // Layout (top-right row)
  layoutUI();

  // Handlers
  loadBtn.mousePressed(() => fileInput.elt.click());

  bwBtn.mousePressed(() => {
    toBW = !toBW;
    markDirty();
  });

  rotBtn.mousePressed(() => {
    rotSteps = (rotSteps + 1) % 4;
    markDirty();
  });

  saveBtn.mousePressed(() => {
    if (!ready) return;
    ensureRendered();
    saveCanvas(cachedG, `result_${stamp()}_div${stripeCount}${toBW ? "_bw" : ""}_rot${rotSteps * 90}`, 'png');
  });

  divMinusBtn.mousePressed(() => {
    stripeCount = Math.max(minStripes, stripeCount - 2);
    if (stripeCount > 0) stripeCount = Math.floor(stripeCount / 2) * 2;
    markDirty();
  });

  divPlusBtn.mousePressed(() => {
    stripeCount = Math.min(maxStripes, stripeCount + 2);
    if (stripeCount > 0) stripeCount = Math.floor(stripeCount / 2) * 2;
    markDirty();
  });

  cachedG = createGraphics(width, height);
}

function windowResized() {
  // Optional: keep it fixed for now
  // If you later want responsive, we’ll resize and markDirty()
  layoutUI();
}

function layoutUI() {
  const pad = 12;
  const y = pad;

  // Measure rough widths by positioning in a row from the right
  // (p5 DOM buttons don’t expose width reliably before render, so we keep it simple)
  const btnW = 70;
  const smallW = 44;
  const gap = 8;

  // right-aligned row: [Load][B/W][Rotate][Save][−][+]
  let x = window.innerWidth - pad;

  divPlusBtn.position(x - smallW, y); x -= (smallW + gap);
  divMinusBtn.position(x - smallW, y); x -= (smallW + gap);

  saveBtn.position(x - btnW, y); x -= (btnW + gap);
  rotBtn.position(x - btnW, y); x -= (btnW + gap);
  bwBtn.position(x - btnW, y); x -= (btnW + gap);
  loadBtn.position(x - btnW, y);
}

function draw() {
  background(255);

  if (!ready) {
    fill(20);
    textSize(16);
    text("Load an image using the button in the top-right", width / 2, height / 2);
    drawHUD();
    return;
  }

  ensureRendered();
  image(cachedG, 0, 0);

  drawHUD();
}

/* ---------- iPad tap handling ---------- */
function touchStarted() {
  // prevent page scroll / zoom gestures interfering
  return false;
}

/* ---------- keyboard (optional) ---------- */
function keyPressed() {
  if (key === 'b' || key === 'B') { toBW = !toBW; markDirty(); }
  if (key === 'r' || key === 'R') { rotSteps = (rotSteps + 1) % 4; markDirty(); }
  if (key === 'l' || key === 'L') { fileInput.elt.click(); }

  if (keyCode === RIGHT_ARROW) { stripeCount = Math.min(maxStripes, stripeCount + 2); markDirty(); }
  if (keyCode === LEFT_ARROW)  { stripeCount = Math.max(minStripes, stripeCount - 2); markDirty(); }

  if (stripeCount > 0) stripeCount = Math.floor(stripeCount / 2) * 2;
}

function handleFile(file) {
  if (!file || file.type !== 'image') return;

  loadImage(file.data, img => {
    srcImg = img;
    srcSquare = cropCenterSquare(srcImg);
    rotSteps = 3;
    stripeCount = 20;
    ready = true;
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

/* ---------- pipeline (renders once per change) ---------- */

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

/* ---------- saving helpers ---------- */

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

/* ---------- stripe logic ---------- */

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

/* ---------- image helpers ---------- */

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

/* ---------- HUD ---------- */

function drawHUD() {
  push();
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(12);

  const bw = toBW ? "ON" : "OFF";
  const hud = `Div: ${stripeCount}  |  B/W: ${bw}  |  Rot: ${rotSteps * 90}°`;
  text(hud, 12, height - 22);
  pop();
}
