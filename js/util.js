import * as THREE from 'three';

// ---------- material / mesh helpers ----------
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts });
}

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(color, opts));
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = !!opts.cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 20), opts.material || mat(color, opts));
  m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = !!opts.cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function ball(parent, r, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), opts.material || mat(color, opts));
  m.position.set(x, y, z);
  if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  m.castShadow = !!opts.cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- canvas textures ----------
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function textPlane(text, { w = 2, h = 0.5, font = 90, fg = '#ffffff', bg = null, bold = true, fontFamily = 'Arial, sans-serif' } = {}) {
  const tex = canvasTexture(512, Math.round(512 * h / w), (g, cw, ch) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); }
    g.fillStyle = fg;
    // Shrink the font until the text fits the canvas width; long text at a
    // large font size otherwise overflows the texture and renders clipped.
    let size = font;
    g.font = `${bold ? 'bold ' : ''}${size}px ${fontFamily}`;
    const maxW = cw - 24;
    const tw = g.measureText(text).width;
    if (tw > maxW) {
      size = Math.max(10, Math.floor(size * maxW / tw));
      g.font = `${bold ? 'bold ' : ''}${size}px ${fontFamily}`;
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cw / 2, ch / 2 + 2);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, side: THREE.DoubleSide })
  );
  return m;
}

// A floating name label sprite (always faces the camera).
export function nameLabel(text, color = '#1f2937') {
  const tex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const r = 18;
    g.beginPath();
    g.roundRect(28, 8, w - 56, h - 16, r);
    g.fill();
    g.fillStyle = color;
    g.font = 'bold 30px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.35, 0.34, 1);
  s.renderOrder = 50;
  return s;
}

// Monitor screen texture full of code-like cyan lines.
export function codeTexture(seed = 1) {
  let s = seed * 7919;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return canvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#0b1526'; g.fillRect(0, 0, w, h);
    const cols = ['#22d3ee', '#67e8f9', '#38bdf8', '#a5f3fc', '#34d399'];
    for (let y = 10; y < h - 6; y += 11) {
      let x = 8 + Math.floor(rnd() * 3) * 14;
      while (x < w - 20) {
        const len = 14 + rnd() * 52;
        g.fillStyle = cols[Math.floor(rnd() * cols.length)];
        g.globalAlpha = 0.55 + rnd() * 0.45;
        g.fillRect(x, y, Math.min(len, w - x - 6), 4.5);
        x += len + 10;
        if (rnd() < 0.3) break;
      }
    }
    g.globalAlpha = 1;
  });
}
