// ─────────────────────────────────────────────────────────────────────────────
// /host — crop a picture to a fixed shape before it uploads: the event poster
// (2:3, like a race poster, saved 1200×1800) and the course map (16:9, saved
// 1600×900). Drag to frame it, slide to zoom; the image always covers the
// frame. Saved as JPEG at 0.85, which is what the app's own uploads use as a
// size/quality balance (every viewer downloads it).
//
// Small and dependency-free on purpose: a CDN cropper would be one more
// script on a page that otherwise loads only supabase-js.
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves with a JPEG Blob, or null if cancelled or unreadable. */
export function cropImage(file, { aspect, outW, outH, title = 'Crop' }) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.onload = () => open(img);
    img.src = url;

    function open(img) {
      const vw = Math.min(window.innerWidth, 560);
      const frameW = Math.min(aspect >= 1 ? 480 : 300, vw - 64);
      const frameH = Math.round(frameW / aspect);
      const base = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
      let zoom = 1;
      let x = (frameW - img.naturalWidth * base) / 2;
      let y = (frameH - img.naturalHeight * base) / 2;

      const wrap = document.createElement('div');
      wrap.className = 'crop';
      wrap.innerHTML = `
        <div class="crop-scrim"></div>
        <div class="crop-card" role="dialog" aria-modal="true" aria-label="${title}">
          <h2 class="modal-title">${title}</h2>
          <div class="crop-frame" style="width:${frameW}px;height:${frameH}px"></div>
          <label class="crop-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value="1"></label>
          <p class="fine">Drag to choose what shows.</p>
          <div class="acts">
            <button type="button" class="btn" data-use>Use this</button>
            <button type="button" class="btn-quiet" data-cancel>Cancel</button>
          </div>
        </div>`;
      const frame = wrap.querySelector('.crop-frame');
      img.draggable = false;
      img.className = 'crop-img';
      frame.appendChild(img);
      document.body.appendChild(wrap);

      const scale = () => base * zoom;
      const clamp = () => {
        const w = img.naturalWidth * scale(), h = img.naturalHeight * scale();
        x = Math.min(0, Math.max(frameW - w, x));
        y = Math.min(0, Math.max(frameH - h, y));
      };
      const paint = () => {
        clamp();
        img.style.width = `${img.naturalWidth * scale()}px`;
        img.style.height = `${img.naturalHeight * scale()}px`;
        img.style.transform = `translate(${x}px, ${y}px)`;
      };
      paint();

      let drag = null;
      frame.addEventListener('pointerdown', (e) => {
        drag = { px: e.clientX, py: e.clientY, x, y };
        frame.setPointerCapture(e.pointerId);
      });
      frame.addEventListener('pointermove', (e) => {
        if (!drag) return;
        x = drag.x + e.clientX - drag.px;
        y = drag.y + e.clientY - drag.py;
        paint();
      });
      const end = () => { drag = null; };
      frame.addEventListener('pointerup', end);
      frame.addEventListener('pointercancel', end);

      const range = wrap.querySelector('input[type=range]');
      range.addEventListener('input', () => {
        // Zoom about the frame's centre.
        const cx = frameW / 2, cy = frameH / 2;
        const before = scale();
        zoom = Number(range.value);
        const k = scale() / before;
        x = cx - (cx - x) * k;
        y = cy - (cy - y) * k;
        paint();
      });

      const close = (value) => {
        document.removeEventListener('keydown', onKey);
        wrap.remove();
        URL.revokeObjectURL(url);
        resolve(value);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      wrap.querySelector('[data-cancel]').addEventListener('click', () => close(null));
      wrap.querySelector('.crop-scrim').addEventListener('click', () => close(null));
      wrap.querySelector('[data-use]').addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outW, outH);
        const s = scale();
        ctx.drawImage(img, -x / s, -y / s, frameW / s, frameH / s, 0, 0, outW, outH);
        canvas.toBlob(b => close(b), 'image/jpeg', 0.85);
      });
    }
  });
}
