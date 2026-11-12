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
