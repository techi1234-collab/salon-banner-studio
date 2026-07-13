let items = [];
let dragIndex = null;

const slots = document.getElementById('slots');
const controls = document.getElementById('controls');
const previewCanvas = document.getElementById('canvas');
const previewCtx = previewCanvas.getContext('2d');
const statusEl = document.getElementById('status');
const imgOut = document.getElementById('imgOut');

const PREVIEW_W = 750;
const PREVIEW_H = 250;
const EXPORT_W = 3000;
const EXPORT_H = 1000;

function load(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url, name: file.name, x: 0, y: 0, zoom: 1.15, flip: false });
    img.onerror = reject;
    img.src = url;
  });
}

document.getElementById('files').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files)
    .filter((file) => file.type.startsWith('image/'))
    .slice(0, 5);

  items.forEach((item) => URL.revokeObjectURL(item.url));
  items = [];
  statusEl.textContent = '読み込み中…';

  for (const file of files) items.push(await load(file));

  renderAll();
  statusEl.textContent = `${items.length}枚読み込みました`;
});

function renderSlots() {
  slots.innerHTML = '';
  const max = Math.max(items.length, 5);

  for (let i = 0; i < max; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.draggable = Boolean(items[i]);
    slot.dataset.index = String(i);

    if (items[i]) {
      slot.innerHTML = `<span class="badge">${i + 1}</span><img src="${items[i].url}">`;
      slot.addEventListener('dragstart', () => {
        dragIndex = i;
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragend', () => {
        dragIndex = null;
        slot.classList.remove('dragging');
      });
      slot.addEventListener('dragover', (e) => e.preventDefault());
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        const to = Number(slot.dataset.index);
        if (dragIndex === null || dragIndex === to) return;
        const moved = items.splice(dragIndex, 1)[0];
        items.splice(to, 0, moved);
        renderAll();
      });
    } else {
      slot.innerHTML = `<span class="badge">${i + 1}</span>画像`;
    }

    slots.appendChild(slot);
  }
}

function renderControls() {
  controls.innerHTML = '';

  items.forEach((item, index) => {
    const box = document.createElement('div');
    box.className = 'itemCtl';
    box.innerHTML = `
      <div class="itemTop">
        <strong>画像${index + 1}</strong>
        <div class="miniBtns">
          <button class="ghost" data-act="left">←</button>
          <button class="ghost" data-act="right">→</button>
          <button class="ghost" data-act="up">↑</button>
          <button class="ghost" data-act="down">↓</button>
          <button class="ghost" data-act="flip">${item.flip ? '反転中' : '左右反転'}</button>
        </div>
      </div>
      <div class="sliderRow"><span>左右</span><input type="range" min="-120" max="120" value="${item.x}" data-kind="x"><span>${item.x}</span></div>
      <div class="sliderRow"><span>上下</span><input type="range" min="-120" max="120" value="${item.y}" data-kind="y"><span>${item.y}</span></div>
      <div class="sliderRow"><span>拡大</span><input type="range" min="90" max="170" value="${Math.round(item.zoom * 100)}" data-kind="zoom"><span>${Math.round(item.zoom * 100)}%</span></div>`;

    box.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.act;
        if (action === 'left') item.x -= 10;
        if (action === 'right') item.x += 10;
        if (action === 'up') item.y -= 10;
        if (action === 'down') item.y += 10;
        if (action === 'flip') item.flip = !item.flip;
        item.x = Math.max(-120, Math.min(120, item.x));
        item.y = Math.max(-120, Math.min(120, item.y));
        renderAll();
      });
    });

    box.querySelectorAll('input[type="range"]').forEach((slider) => {
      slider.addEventListener('input', () => {
        if (slider.dataset.kind === 'x') item.x = Number(slider.value);
        if (slider.dataset.kind === 'y') item.y = Number(slider.value);
        if (slider.dataset.kind === 'zoom') item.zoom = Number(slider.value) / 100;
        renderAll(false);
      });
    });

    controls.appendChild(box);
  });
}

function fontCss() {
  const value = document.getElementById('fontFamily').value;
  if (value === 'mincho') return '"Yu Mincho","Hiragino Mincho ProN","Times New Roman",serif';
  if (value === 'gothic') return '"Hiragino Sans","Yu Gothic",Arial,sans-serif';
  if (value === 'didot') return 'Didot,"Bodoni 72","Times New Roman",serif';
  if (value === 'bodoni') return '"Bodoni 72","Bodoni 72 Smallcaps","Times New Roman",serif';
  if (value === 'script') return '"Snell Roundhand","Zapfino","Brush Script MT",cursive';
  return 'Georgia,"Times New Roman",serif';
}

function coverParams(item, targetW, targetH, scaleFactor) {
  const img = item.img;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(targetW / iw, targetH / ih) * item.zoom;
  const sourceW = targetW / scale;
  const sourceH = targetH / scale;
  let sourceX = (iw - sourceW) / 2 + (item.x * scaleFactor) / scale;
  let sourceY = (ih - sourceH) * 0.36 + (item.y * scaleFactor) / scale;
  sourceX = Math.max(0, Math.min(iw - sourceW, sourceX));
  sourceY = Math.max(0, Math.min(ih - sourceH, sourceY));
  return { sourceX, sourceY, sourceW, sourceH };
}

function drawImageToContext(ctx, item, x, y, width, height, scaleFactor) {
  const p = coverParams(item, width, height, scaleFactor);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (item.flip) {
    ctx.translate(x + width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(item.img, p.sourceX, p.sourceY, p.sourceW, p.sourceH, 0, 0, width, height);
  } else {
    ctx.drawImage(item.img, p.sourceX, p.sourceY, p.sourceW, p.sourceH, x, y, width, height);
  }
  ctx.restore();
}

function drawClippedImage(ctx, item, imageX, imageY, imageW, imageH, clipX, clipW, scaleFactor, alpha = 1) {
  if (clipW <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, imageY, clipW, imageH);
  ctx.clip();
  ctx.globalAlpha = alpha;
  drawImageToContext(ctx, item, imageX, imageY, imageW, imageH, scaleFactor);
  ctx.restore();
}

function drawCrossfade(ctx, item, imageX, imageY, imageW, imageH, overlap, scaleFactor) {
  if (overlap <= 0) return;

  // iPhone Safariでも安定するように、offscreen canvasのマスク処理ではなく
  // 細い縦帯を重ねてクロスフェードします。
  const steps = Math.max(24, Math.min(96, Math.round(overlap / 2)));
  const sliceW = overlap / steps;

  for (let step = 0; step < steps; step += 1) {
    const t = (step + 0.5) / steps;

    // なめらかなS字カーブ。中央は自然に混ざり、端で急に切れません。
    const alpha = t * t * (3 - 2 * t);
    const clipX = imageX + step * sliceW;

    drawClippedImage(
      ctx,
      item,
      imageX,
      imageY,
      imageW,
      imageH,
      clipX,
      sliceW + 1,
      scaleFactor,
      alpha
    );
  }
}

function renderScene(ctx, width, height) {
  const scaleFactor = width / PREVIEW_W;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(0, 0, width, height);

  const count = items.length;
  if (!count) {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `${20 * scaleFactor}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('画像を4〜5枚選択してください', width / 2, height / 2);
    ctx.restore();
    return;
  }

  const seamless = document.getElementById('seamlessOn').checked;
  const overlapSetting = Number(document.getElementById('overlap').value || 0);
  const fadeSetting = Number(document.getElementById('fadeWidth').value || 0);

  if (!seamless) {
    const segmentW = width / count;
    for (let i = 0; i < count; i += 1) {
      drawImageToContext(ctx, items[i], i * segmentW, 0, segmentW, height, scaleFactor);
    }
  } else {
    // 重なり幅とぼかし幅の大きい方を実際のクロスフェード幅として使用。
    const overlap = Math.max(overlapSetting, fadeSetting) * scaleFactor;
    const safeOverlap = Math.min(overlap, width / count * 0.7);
    const segmentW = (width + safeOverlap * (count - 1)) / count;

    // 1枚目は全面描画。
    drawImageToContext(ctx, items[0], 0, 0, segmentW, height, scaleFactor);

    for (let i = 1; i < count; i += 1) {
      const x = i * (segmentW - safeOverlap);

      // 重なり部分より右側を不透明で描画。
      drawClippedImage(
        ctx,
        items[i],
        x,
        0,
        segmentW,
        height,
        x + safeOverlap,
        segmentW - safeOverlap,
        scaleFactor,
        1
      );

      // 重なり部分のみ、左0%→右100%のクロスフェード。
      drawCrossfade(
        ctx,
        items[i],
        x,
        0,
        segmentW,
        height,
        safeOverlap,
        scaleFactor
      );
    }
  }

  drawText(ctx, width, height, scaleFactor);
  ctx.restore();
}

function drawText(ctx, width, height, scaleFactor) {
  const position = document.getElementById('textPos').value;
  const text = document.getElementById('shop').value.trim();
  if (position === 'none' || !text) return;

  const fontSize = Number(document.getElementById('fontSize').value || 34) * scaleFactor;
  const marginX = 34 * scaleFactor;
  let x = width / 2;
  let y = 208 * scaleFactor;
  let align = 'center';

  if (position === 'top') y = 48 * scaleFactor;
  if (position === 'center') y = height / 2;
  if (position === 'bottomLeft') { x = marginX; align = 'left'; }
  if (position === 'bottomRight') { x = width - marginX; align = 'right'; }

  ctx.save();
  ctx.font = `${fontSize}px ${fontCss()}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (document.getElementById('shadowOn').checked) {
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 7 * scaleFactor;
    ctx.shadowOffsetY = 2 * scaleFactor;
  }
  ctx.fillStyle = document.getElementById('textColor').value;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPreview() {
  try {
    renderScene(previewCtx, PREVIEW_W, PREVIEW_H);
  } catch (error) {
    console.error('Preview render error:', error);
    previewCtx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    previewCtx.fillStyle = '#eeeeee';
    previewCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
    previewCtx.fillStyle = '#8a7665';
    previewCtx.font = '16px sans-serif';
    previewCtx.textAlign = 'center';
    previewCtx.textBaseline = 'middle';
    previewCtx.fillText('プレビューの描画に失敗しました', PREVIEW_W / 2, PREVIEW_H / 2);
    statusEl.textContent = 'プレビュー描画エラーが発生しました。ページを再読み込みしてください。';
  }
}

function renderAll(rebuild = true) {
  renderSlots();
  if (rebuild) renderControls();
  drawPreview();
}

function saveHighResolution() {
  statusEl.textContent = '3000×1000pxで高画質レンダリング中…';
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = EXPORT_W;
  exportCanvas.height = EXPORT_H;
  const exportCtx = exportCanvas.getContext('2d');

  // Original photos are drawn directly into the 3000×1000 canvas.
  renderScene(exportCtx, EXPORT_W, EXPORT_H);

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = '保存用画像の作成に失敗しました。';
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'salon-banner-studio-3000x1000.png';
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    imgOut.innerHTML = `<p class="note">3000×1000pxで直接描画しました。保存できない場合は下の画像を長押し保存してください。</p><img src="${blobUrl}" alt="高画質バナー">`;
    statusEl.textContent = '高画質PNGを作成しました。';
  }, 'image/png');
}

document.getElementById('save').addEventListener('click', saveHighResolution);

['shop','fontFamily','textColor','fontSize','textPos','shadowOn','seamlessOn','overlap','fadeWidth'].forEach((id) => {
  const element = document.getElementById(id);
  element.addEventListener('input', () => renderAll(false));
  element.addEventListener('change', () => renderAll(false));
});

document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById('textColor').value = button.dataset.color;
    renderAll(false);
  });
});

renderAll();
