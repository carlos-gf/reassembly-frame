let srcImg = null;       // p5.Image loaded
let srcSquare = null;    // p5.Image center-cropped square
let ready = false;

let stripeCount = 20;
let minStripes = 0;      // allow 0 (mirrored only)
let maxStripes = 80;     // keep even

let toBW = false;
let rotSteps = 3;        // default (your “press R three times” fix)

let fileInput;

function setup() {
  createCanvas(900, 900);
  pixelDensity(1);

  // File input (works on iPad Safari too)
  fileInput = createFileInput(handleFile);
  fileInput.position(12, 12);
  fileInput.style('opacity', '0');      // hide default UI
  fileInput.style('width', '1px');
  fileInput.style('height', '1px');

  textAlign(CENTER, CENTER);
  textSize(16);
}

function draw() {
  background(255);

  if (!ready) {
    fill(20);
    text("Tap to load an image", width / 2, height / 2);
    drawHUD();
    return;
  }

  const result = runPipeline();
  image(result, 0, 0, width, height);

  drawHUD();
}

function mousePressed() {
  if (!ready) {
    fileInput.elt.click();
  }
}

function keyPressed() {
  // Divisions (even steps)
  if (keyCode === RIGHT_ARROW) stripeCount = Math.min(maxStripes, stripeCount + 2);
  if (keyCode === LEFT_ARROW)  stripeCount = Math.max(minStripes, stripeCount - 2);
  if (keyCode === UP_ARROW)    stripeCount = Math.min(maxStripes, stripeCount + 10);
  if (keyCode === DOWN_ARROW)  stripeCount = Math.max(minStripes, stripeCount - 10);

  if (key === 'b' || key === 'B') toBW = !toBW;
  if (key === 'r' || key === 'R') rotSteps = (rotSteps + 1) % 4;
  if (key === 'e' || key === 'E') rotSteps = (rotSteps + 3) % 4;

  if (key === 'l' || key === 'L') fileInput.elt.click();
  if (key === 's' || key === 'S') if (ready) saveCurrentResult();
  if (key === 'o' || key === 'O') if (ready) saveOriginalCrop();

  // safety evenness (except 0)
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
  });
}

/* ---------------- Pipeline ---------------- */

function runPipeline() {
  const qW = Math.floor(width / 2);
  const qH = Math.floor(height / 2);

  let oriented = rotateSquareBySteps(srcSquare, rotSteps);
  let fitted = fitCenter(oriented, qW, qH);

  if (toBW) fitted = toGrayscale(fitted);

  // 2x2 mirrored base
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

  // 0 or 1 divisions: just mirrored base
  if (stripeCount <= 1) return base;

  // reorder stripes
  const step1 = reorderVerticalStripes(base, stripeCount);
  const step2 = reorderHorizontalStripes(step1, stripeCount);
  return step2;
}

/* ---------------- Saving ---------------- */

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

function saveCurrentResult() {
  const g = runPipeline();
  saveCanvas(g, `result_${stamp()}_div${stripeCount}${toBW ? "_bw" : ""}_rot${rotSteps * 90}`, 'png');
}

function saveOriginalCrop() {
  let oriented = rotateSquareBySteps(srcSquare, rotSteps);
  if (toBW) oriented = toGrayscale(oriented);

  // draw into a graphics so we can save cleanly
  const g = createGraphics(oriented.width, oriented.height);
  g.image(oriented, 0, 0);
  saveCanvas(g, `originalCrop_${stamp()}${toBW ? "_bw" : ""}_rot${rotSteps * 90}`, 'png');
}

/* ---------------- Stripe logic ---------------- */

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

/* ---------------- Image helpers ---------------- */

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

  const side = img.width; // square
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

/* ---------------- HUD ---------------- */

function drawHUD() {
  push();
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(12);

  const bw = toBW ? "ON" : "OFF";
  const hud =
    `Tap: load (or press L)   B: B/W(${bw})   R/E: rotate   S: save result   O: save crop   ` +
    `Div: ${stripeCount} (0 mirrored, arrows change)`;

  text(hud, 12, height - 24);
  pop();
}