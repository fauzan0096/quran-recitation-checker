// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Play Store ke liye screenshot taiyar karne wala chhota tool (screenshots.html).
// Phone ka screenshot leta hai aur theek 1080×1920 PNG bana deta hai — Play isi
// size (9:16) ko sab se behtar maanta hai. Kuch upload nahi hota: sab kaam phone
// par hi hota hai.

const WIDTH = 1080;
const HEIGHT = 1920;
const PAPER = '#f7f1e6';

const input = document.getElementById('files');
const fill = document.getElementById('fill');
const list = document.getElementById('list');
const items = document.getElementById('items');

/** Ek tasveer ko 1080×1920 par baithata hai (ya bhar deta hai). */
function draw(image, crop) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return canvas;

  const scale = crop
    ? Math.max(WIDTH / iw, HEIGHT / ih)
    : Math.min(WIDTH / iw, HEIGHT / ih);
  const w = Math.round(iw * scale);
  const h = Math.round(ih * scale);
  const x = Math.round((WIDTH - w) / 2);
  const y = Math.round((HEIGHT - h) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x, y, w, h);
  return canvas;
}

function nameFor(file, index) {
  const base = String(file.name || `screenshot-${index + 1}`)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 40);
  return `${base || `shot-${index + 1}`}-1080x1920.png`;
}

function download(canvas, name) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

function addItem(file, index) {
  const image = new Image();
  const url = URL.createObjectURL(file);

  image.onload = () => {
    const holder = document.createElement('div');
    holder.className = 'item';

    let canvas = draw(image, fill.checked);

    const head = document.createElement('div');
    head.className = 'row';
    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.textContent = `1080×1920`;
    const size = document.createElement('span');
    size.className = 'hint';
    size.textContent = `${image.naturalWidth}×${image.naturalHeight} se banaya`;
    head.append(tag, size);

    const row = document.createElement('div');
    row.className = 'row';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = '⬇ PNG save karein';
    save.addEventListener('click', () => download(canvas, nameFor(file, index)));
    const redraw = document.createElement('button');
    redraw.type = 'button';
    redraw.className = 'ghost';
    redraw.textContent = '↻ Dobara banayein';
    redraw.addEventListener('click', () => {
      canvas = draw(image, fill.checked);
      holder.querySelector('canvas').replaceWith(canvas);
      URL.revokeObjectURL(url);
    });
    row.append(save, redraw);

    holder.append(head, canvas, row);
    items.appendChild(holder);
    list.hidden = false;
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
  };

  image.src = url;
}

input.addEventListener('change', () => {
  const files = Array.from(input.files || []);
  files.forEach((file, index) => addItem(file, index));
  input.value = '';
});

// ------------------------------------------------------------- feature graphic
// Play listing ke sab se upar wali 1024×500 tasveer. Canvas par banti hai, is liye
// har phone par ek hi shakal me aati hai.
const FW = 1024;
const FH = 500;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Ek chhoti si gold arch — masjid ka ishara. */
function arch(ctx, cx, baseY, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, baseY);
  ctx.lineTo(cx - r, baseY - h + r);
  ctx.arc(cx, baseY - h + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, baseY);
  ctx.stroke();
}

function drawFeature() {
  const canvas = document.getElementById('feature');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, FW, FH);
  bg.addColorStop(0, '#3d1419');
  bg.addColorStop(0.55, '#4b1b21');
  bg.addColorStop(1, '#2c0f13');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FW, FH);

  const glow = ctx.createRadialGradient(FW - 130, 90, 20, FW - 130, 90, 380);
  glow.addColorStop(0, 'rgba(216,166,107,0.38)');
  glow.addColorStop(1, 'rgba(216,166,107,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FW, FH);

  ctx.strokeStyle = 'rgba(231,201,168,0.5)';
  ctx.lineWidth = 3;
  roundRect(ctx, 22, 22, FW - 44, FH - 44, 28);
  ctx.stroke();

  // ornaments, right side
  ctx.strokeStyle = 'rgba(231,201,168,0.35)';
  ctx.lineWidth = 4;
  arch(ctx, FW - 210, FH - 96, 120, 190);
  arch(ctx, FW - 340, FH - 96, 90, 150);

  // Arabic name
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f3d9b0';
  ctx.font = '700 150px "Amiri Quran", "Traditional Arabic", serif';
  ctx.fillText('بيّن', FW - 170, FH / 2 - 6);

  // Latin name + lines
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff6eb';
  ctx.font = '700 76px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Bayyin', 98, FH / 2 - 52);

  ctx.fillStyle = '#e7c9a8';
  ctx.font = '400 31px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Quran recitation — checked on the phone', 100, FH / 2 + 22);

  ctx.fillStyle = 'rgba(231,201,168,0.75)';
  ctx.font = '400 23px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('No recording leaves your phone  •  Duaein, tasbeeh, namaz, qibla', 100, FH / 2 + 74);
}

const featureSave = document.getElementById('feature-save');
if (featureSave) {
  featureSave.addEventListener('click', () => {
    const canvas = document.getElementById('feature');
    if (canvas) download(canvas, 'bayyin-feature-1024x500.png');
  });
}

if (document.fonts && document.fonts.load) {
  document.fonts.load('700 150px "Amiri Quran"').then(drawFeature).catch(drawFeature);
} else {
  drawFeature();
}
