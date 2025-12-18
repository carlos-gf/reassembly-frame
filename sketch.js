let srcImg = null;
let srcSquare = null;
let ready = false;

let stripeCount = 20;
let minStripes = 0;
let maxStripes = 80;

let toBW = false;
let rotSteps = 3;

let container;
let uiWrap;
let controlsRow;
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

  // Prevent iOS pinch/scroll on the canvas only (do NOT block UI taps)
  const c = document.querySelector('canvas');
  c.style.touchAction = 'none';
  c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  c.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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

  const c = document.querySelector('canvas');
  container.elt.appendChild(c);
  c.style.display = 'block';
  c.style.margin = '0';
}

function applyResponsiveLayout() {
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 520;
  const pad = isSmall ? 12 : 24;
  const gap = 14;

  const isHorizontal = window.innerWidth >= window.innerHeight;

  let availW, availH, canvasSide;

  if (isHorizontal) {
    const uiWTarget = isSmall ? 200 : 260;
    const uiW = Math.min(uiWTarget, Math.max(160, Math.floor(window.innerWidth * 0.32)));

    availW = window.innerWidth - pad * 2 - uiW - gap;
    availH = window.innerHeight - pad * 2;

    canvasSide = Math.floor(Math.max(180, Math.min(availW, availH)));

    container.style('flex-direction', 'row');
    uiWrap.style('width', `${uiW}px`);
    uiWrap.style('max-width', `${uiW}px`);
  } else {
    const uiH = isSmall ? 170 : 160;

    availW = window.innerWidth - pad * 2;
    availH = window.innerHeight - pad * 2 - uiH - gap;

    canvasSide = Math.floor(Math.max(180, Math.min(availW, availH)));

    container.style('flex-direction', 'column');
    uiWrap.style('width', `${canvasSide}px`);
    uiWrap.style('max-width', `${canvasSide}px`);
  }

  canvasSide = Math.min(canvasSide, window.innerWidth - pad * 2);

  resizeCanvas(canvasSide, canvasSide);
  cachedG = createGraphics(width, height);
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

  fileInput = createFileInput(handleFile);
  fileInput.parent(controlsRow);
  fileInput.attribute('accept', 'image/*');
  styleControl(fileInput);
  fileInput.style('max-width', '180px');

  // Stepper container for − / + (keeps them side by side)
  const stepper = createDiv();
  stepper.parent(controlsRow);
  stepper.style('display', 'flex');
  stepper.style('gap', '6px');
  stepper.style('flex-wrap', 'nowrap');
  stepper.style('align-items', 'center');

  minusBtn = createButton('−');
  minusBtn.parent(stepper);
  styleControl(minusBtn);

  plusBtn = createButton('+');
  plusBtn.parent(stepper);
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
  el.style('border-radius', '0px');
  el.style('cursor', 'pointer');
  el.style('pointer-events', 'auto');

  // Helps mobile layout + keeps buttons readable
  el.style('min-width', '36px');
  el.style('text-align', 'center');

  // iOS Safari tap behavior
  el.elt.style.touchAction = 'manipulation';
  el.elt.style.webkitTapHighlightColor = 'transparent';
  el.elt.style.userSelect = 'none';
}

function updateDivLabel() {
  let label = `Divisions: ${stripeCount}`;
  if (stripeCount === 0) label = 'Divisions: 0 (original)';
  if (stripeCount === 2) label = 'Divisions: 2 (mirrored)';
  if (stripeCount >= 4) label = `Divisions: ${stripeCount} (processed)`;
  divLabel.html(label);
}

// Allow only 0 or even >= 2
function normalizeStripeCount(n) {
  if (n <= 0) return 0;
  if (n === 1) return 2;
  return Math.floor(n / 2) * 2;
}

/* ---------------- Keyboard controls ---------------- */

function keyPressed() {
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
  fill(230);
  rect(0, 0, width, height);

  noFill();
  stroke(200);
  rect(0.5, 0.5, width - 1, height - 1);

  fill(120);
  noStroke();
  textSize(16);
  text("Choose an image using the file input", width / 2, height / 2);
}

/* ---------------- Image loading ---------------- */

function handleFile(file) {
  if (!file || file.type !== 'image') return;

  loadImage(file.data, img => {
    srcImg = img;

    let sq = cropCenterSquare(srcImg);
    if (sq.width > MAX_WORKING_SIZE) sq.resize(MAX_WORKING_SIZE, MAX_WORKING_SIZE);
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
  let oriented = rotateSquareBySteps(srcSquare, rotSteps);
  if (toBW) oriented = toGrayscale(oriented);

  // 0 = show original cropped square
  if (stripeCount === 0) {
    const g = createGraphics(width, height);
    g.background(255);
    g.imageMode(CENTER);
    const s = Math.min(width / oriented.width, height / oriented.height);
    g.image(oriented, width / 2, height / 2, oriented.width * s, oriented.height * s);
    return g;
  }

  // 2+ = mirrored base
  const qW = Math.floor(width / 2);
  const qH = Math.floor(height / 2);

  let fitted = fitCenter(oriented, qW, qH);

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

  // 2 = mirrored only
  if (stripeCount === 2) return base;

  // 4+ = reorder stripes
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
