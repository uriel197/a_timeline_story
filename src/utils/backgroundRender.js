export function drawSegmentBackgrounds(
  node,
  ctx,
  camera,
  canvasWidth,
  canvasHeight,
  backgroundsEnabled,
) {
  // Skip all background drawing if global flag is set
  if (window.hideAllBackgrounds === true) {
    return; // ← early exit — no backgrounds drawn
  }

  if (!node.isLoaded || !node.data?.points?.length) return;

  if (backgroundsEnabled) {
    for (let i = 0; i < node.data.points.length - 1; i++) {
      const relStart = node.data.points[i];
      const relEnd = node.data.points[i + 1];

      const segWorldStart =
        node.worldStart + (node.worldEnd - node.worldStart) * relStart;
      const segWorldEnd =
        node.worldStart + (node.worldEnd - node.worldStart) * relEnd;

      const x1 = camera.toScreen(segWorldStart, canvasWidth);
      const x2 = camera.toScreen(segWorldEnd, canvasWidth);

      const segWidth = x2 - x1;
      if (segWidth < 2 || x2 < 0 || x1 > canvasWidth) continue;

      const padding = 20; // pixels of space on each side – adjust this value (4–20 looks good)
      const paddedX1 = x1 + padding;
      const paddedX2 = x2 - padding;
      const paddedWidth = paddedX2 - paddedX1;

      if (paddedWidth < 10) continue; // skip if too narrow after padding
      const img = node.segmentImages[i];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(paddedX1, -100, paddedWidth, canvasHeight);
        ctx.clip();

        ctx.globalAlpha = 0.65;

        const imgRatio = img.naturalWidth / img.naturalHeight;
        const segRatio = paddedWidth / canvasHeight;

        let drawW,
          drawH,
          offsetX = 0,
          offsetY = 0;
        if (imgRatio > segRatio) {
          drawH = canvasHeight;
          drawW = drawH * imgRatio;
          offsetX = (segWidth - drawW) / 2;
        } else {
          drawW = segWidth;
          drawH = drawW / imgRatio;
          offsetY = (canvasHeight - drawH) / 2;
        }

        ctx.drawImage(img, paddedX1 + offsetX, offsetY, drawW, drawH);

        ctx.globalAlpha = 1.0;
        ctx.restore();
      } else {
        // fallback
        const grad = ctx.createLinearGradient(
          paddedX1,
          0,
          paddedX2,
          canvasHeight,
        );
        grad.addColorStop(0, "#2a3a4a");
        grad.addColorStop(1, "#1a2a3a");
        ctx.fillStyle = grad;
        ctx.fillRect(paddedX1, 0, paddedWidth, canvasHeight);
      }
    }
  }
}
