// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Paints a WhatsApp-status sized card (1080 × 1920) and hands it to the share
// sheet, or downloads it when sharing files is not available.

const WIDTH = 1080;
const HEIGHT = 1920;
// Where a viewer of the status can get the app: the Play Store listing.
export const APP_URL = 'play.google.com/store/apps/details?id=bayyin.app';
export const PLAY_URL = `https://${APP_URL}`;
/** Printed on the status image — short enough to read on a phone. */
const PLAY_LINE = 'App: play.google.com/store/apps/details?id=bayyin.app';
const ARABIC_FONT = '"SF Arabic", "Geeza Pro", "Noto Naskh Arabic", "Amiri Quran", serif';
const LATIN_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrink the font until the wrapped text fits the given box. */
function fit(ctx, text, { max, min, width, height, lineHeight, font }) {
  let size = max;
  let lines = [];
  while (size >= min) {
    ctx.font = `500 ${size}px ${font}`;
    lines = wrap(ctx, text, width);
    if (lines.length * size * lineHeight <= height) break;
    size -= 4;
  }
  return { size, lines };
}

function paint(canvas, { title, arabic, text, reference }) {
  const ctx = canvas.getContext('2d');
  const mid = WIDTH / 2;

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#fbf6ec');
  bg.addColorStop(0.55, '#f4ead9');
  bg.addColorStop(1, '#e9ddc6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(mid, 420, 60, mid, 420, 720);
  glow.addColorStop(0, 'rgba(176, 122, 60, 0.18)');
  glow.addColorStop(1, 'rgba(176, 122, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bar = ctx.createLinearGradient(0, 0, WIDTH, 0);
  bar.addColorStop(0, '#4a1622');
  bar.addColorStop(0.5, '#6b2233');
  bar.addColorStop(1, '#4a1622');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, WIDTH, 132);
  ctx.fillRect(0, HEIGHT - 132, WIDTH, 132);

  ctx.strokeStyle = '#b07a3c';
  ctx.lineWidth = 6;
  roundRect(ctx, 52, 200, WIDTH - 104, HEIGHT - 400, 40);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.fillStyle = '#f7f1e6';
  ctx.font = `500 46px ${ARABIC_FONT}`;
  ctx.fillText('بيّن', mid - 92, 68);
  ctx.font = `600 32px ${LATIN_FONT}`;
  ctx.fillStyle = '#e7c9a8';
  ctx.fillText('BAYYIN', mid + 66, 70);

  ctx.fillStyle = '#8a756c';
  ctx.font = `600 30px ${LATIN_FONT}`;
  ctx.fillText(String(title || '').toUpperCase(), mid, 300);

  let cursor = 400;
  if (arabic) {
    const box = fit(ctx, arabic, {
      max: 78,
      min: 40,
      width: WIDTH - 260,
      height: 820,
      lineHeight: 1.9,
      font: ARABIC_FONT,
    });
    ctx.direction = 'rtl';
    ctx.fillStyle = '#2b1c20';
    ctx.font = `500 ${box.size}px ${ARABIC_FONT}`;
    const lineHeight = box.size * 1.9;
    const blockHeight = box.lines.length * lineHeight;
    let y = 420 + (820 - blockHeight) / 2;
    for (const line of box.lines) {
      ctx.fillText(line, mid, y + lineHeight / 2);
      y += lineHeight;
    }
    cursor = 420 + 820;
  } else if (text) {
    const box = fit(ctx, text, {
      max: 56,
      min: 34,
      width: WIDTH - 300,
      height: 820,
      lineHeight: 1.7,
      font: LATIN_FONT,
    });
    ctx.direction = 'ltr';
    ctx.fillStyle = '#2b1c20';
    ctx.font = `500 ${box.size}px ${LATIN_FONT}`;
    const lineHeight = box.size * 1.7;
    const blockHeight = box.lines.length * lineHeight;
    let y = 420 + (820 - blockHeight) / 2;
    for (const line of box.lines) {
      ctx.fillText(line, mid, y + lineHeight / 2);
      y += lineHeight;
    }
    cursor = 420 + 820;
  }

  ctx.direction = 'ltr';
  if (reference) {
    ctx.font = `600 30px ${LATIN_FONT}`;
    const label = String(reference);
    const padding = 34;
    const textWidth = ctx.measureText(label).width;
    const width = textWidth + padding * 2;
    const y = cursor + 40;
    ctx.fillStyle = 'rgba(176, 122, 60, 0.16)';
    roundRect(ctx, mid - width / 2, y, width, 76, 38);
    ctx.fill();
    ctx.strokeStyle = 'rgba(176, 122, 60, 0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, mid - width / 2, y, width, 76, 38);
    ctx.stroke();
    ctx.fillStyle = '#7c5a2e';
    ctx.fillText(label, mid, y + 40);
  }

  ctx.fillStyle = 'rgba(247, 241, 230, 0.85)';
  ctx.font = `500 26px ${ARABIC_FONT}`;
  ctx.fillText('بيّن', mid - 26, HEIGHT - 108);
  ctx.font = `600 20px ${LATIN_FONT}`;
  ctx.fillStyle = '#8a5a28';
  ctx.fillText(PLAY_LINE, mid, HEIGHT - 72);
  ctx.fillStyle = 'rgba(231, 201, 168, 0.8)';
  ctx.font = `400 22px ${LATIN_FONT}`;
  ctx.fillText('·  © 2026 F A FS', mid + 118, HEIGHT - 36);
}

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Paint and share one card.
 * Returns 'shared', 'downloaded' or 'failed'.
 */
export async function shareStatus({ title, arabic, text, reference, message }) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    paint(canvas, { title, arabic, text, reference });
    const blob = await toBlob(canvas);
    if (!blob) return 'failed';
    const filename = 'bayyin-status.png';
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: message ? `${message}\n${PLAY_URL}` : PLAY_URL });
      return 'shared';
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  } catch (error) {
    if (error && error.name === 'AbortError') return 'shared';
    return 'failed';
  }
}



/** Paint the whole page once, as a PNG blob. */
async function dailyBlob({ date, hijri, items }) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  paintDailyPage(canvas.getContext('2d'), { date, hijri, items: items || [] });
  return toBlob(canvas);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Share the page to WhatsApp status: the designed PNG, with the Play Store line
 * printed on it, plus the link as the caption so it opens for the viewer.
 * Returns 'shared', 'downloaded' or 'failed'.
 */
export async function shareDailyPage(payload) {
  try {
    const blob = await dailyBlob(payload);
    if (!blob) return 'failed';
    const file = new File([blob], 'bayyin-naiki.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: PLAY_URL });
      return 'shared';
    }
    saveBlob(blob, 'bayyin-naiki.png');
    return 'downloaded';
  } catch (error) {
    if (error && error.name === 'AbortError') return 'shared';
    return 'failed';
  }
}

/** Save the same page as a PNG file. */
export async function downloadDailyPage(payload) {
  try {
    const blob = await dailyBlob(payload);
    if (!blob) return 'failed';
    saveBlob(blob, 'bayyin-naiki.png');
    return 'downloaded';
  } catch (error) {
    return 'failed';
  }
}

function paintDailyPage(ctx, { date, hijri, items }) {
  const mid = WIDTH / 2;

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#5a1b2a');
  bg.addColorStop(0.55, '#3c1019');
  bg.addColorStop(1, '#240a11');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(mid, 240, 40, mid, 240, 640);
  glow.addColorStop(0, 'rgba(240, 193, 147, 0.22)');
  glow.addColorStop(1, 'rgba(240, 193, 147, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';

  ctx.fillStyle = '#f6d4a8';
  ctx.font = `500 58px ${ARABIC_FONT}`;
  ctx.fillText('بيّن', mid, 98);
  ctx.font = `700 30px ${LATIN_FONT}`;
  ctx.fillStyle = 'rgba(255, 246, 235, 0.85)';
  ctx.fillText('BAYYIN', mid, 154);

  if (date) {
    ctx.font = `500 28px ${LATIN_FONT}`;
    ctx.fillStyle = 'rgba(255, 246, 235, 0.72)';
    ctx.fillText(String(date), mid, 204);
  }
  if (hijri) {
    ctx.font = `500 36px ${ARABIC_FONT}`;
    ctx.fillStyle = 'rgba(240, 193, 147, 0.92)';
    ctx.fillText(String(hijri), mid, 250);
  }

  const pad = 56;
  const gap = 22;
  const top = 300;
  const bottom = HEIGHT - 120;
  const height = Math.floor((bottom - top - 44) / 3);
  let y = top;

  for (const item of items.slice(0, 3)) {
    ctx.fillStyle = 'rgba(255, 246, 235, 0.055)';
    roundRect(ctx, pad, y, WIDTH - pad * 2, height, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 193, 147, 0.45)';
    ctx.lineWidth = 2;
    roundRect(ctx, pad, y, WIDTH - pad * 2, height, 34);
    ctx.stroke();

    let cy = y + 48;
    ctx.font = `700 26px ${LATIN_FONT}`;
    ctx.fillStyle = '#f0c193';
    ctx.fillText(String(item.title || '').toUpperCase(), mid, cy);
    cy += 56;

    if (item.arabic) {
      const box = fit(ctx, item.arabic, {
        max: 54,
        min: 28,
        width: WIDTH - pad * 2 - 84,
        height: height * 0.44,
        lineHeight: 1.9,
        font: ARABIC_FONT,
      });
      ctx.direction = 'rtl';
      ctx.fillStyle = '#fdf6ea';
      ctx.font = `500 ${box.size}px ${ARABIC_FONT}`;
      const lineHeight = box.size * 1.9;
      let ay = cy + 10;
      for (const line of box.lines) {
        ctx.fillText(line, mid, ay + lineHeight / 2);
        ay += lineHeight;
      }
      cy = ay + 8;
      ctx.direction = 'ltr';
    }

    if (item.text) {
      const box = fit(ctx, item.text, {
        max: 34,
        min: 22,
        width: WIDTH - pad * 2 - 84,
        height: height * 0.28,
        lineHeight: 1.5,
        font: LATIN_FONT,
      });
      ctx.fillStyle = 'rgba(255, 246, 235, 0.84)';
      ctx.font = `500 ${box.size}px ${LATIN_FONT}`;
      const lineHeight = box.size * 1.5;
      let ty = cy + 6;
      for (const line of box.lines) {
        ctx.fillText(line, mid, ty + lineHeight / 2);
        ty += lineHeight;
      }
      cy = ty + 4;
    }

    if (item.reference) {
      ctx.font = `600 24px ${LATIN_FONT}`;
      const label = String(item.reference);
      const chipWidth = ctx.measureText(label).width + 52;
      const chipY = Math.min(y + height - 62, cy + 4);
      ctx.fillStyle = 'rgba(240, 193, 147, 0.14)';
      roundRect(ctx, mid - chipWidth / 2, chipY, chipWidth, 50, 25);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240, 193, 147, 0.5)';
      roundRect(ctx, mid - chipWidth / 2, chipY, chipWidth, 50, 25);
      ctx.stroke();
      ctx.fillStyle = '#f0c193';
      ctx.fillText(label, mid, chipY + 26);
    }

    y += height + gap;
  }

  ctx.font = `500 28px ${ARABIC_FONT}`;
  ctx.fillStyle = 'rgba(255, 246, 235, 0.8)';
  ctx.fillText('بيّن', mid, HEIGHT - 116);
  ctx.font = `600 22px ${LATIN_FONT}`;
  ctx.fillStyle = 'rgba(240, 193, 147, 0.92)';
  ctx.fillText(PLAY_LINE, mid, HEIGHT - 74);
  ctx.font = `400 20px ${LATIN_FONT}`;
  ctx.fillStyle = 'rgba(240, 193, 147, 0.7)';
  ctx.fillText('© 2026 F A FS', mid, HEIGHT - 36);
}
