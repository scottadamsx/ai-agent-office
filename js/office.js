import * as THREE from 'three';
import { mat, box, cyl, ball, canvasTexture, textPlane, codeTexture } from './util.js';

export const WALL_H = 3;
const T = 0.25; // wall thickness

// Axis-aligned wall runs with rectangular door gaps.
// gaps: array of [from, to] measured along the run axis.
function hWall(group, colliders, z, xFrom, xTo, gaps = [], color = 0xf1f5f9) {
  let cur = xFrom;
  const segs = [];
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  for (const [g0, g1] of sorted) { segs.push([cur, g0]); cur = g1; }
  segs.push([cur, xTo]);
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue;
    const w = b - a, cx = (a + b) / 2;
    box(group, w, WALL_H, T, color, cx, WALL_H / 2, z, { cast: false });
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: z - T / 2, maxZ: z + T / 2 });
  }
  for (const [g0, g1] of gaps) { // lintel above the doorway
    box(group, g1 - g0, WALL_H - 2.3, T, color, (g0 + g1) / 2, 2.3 + (WALL_H - 2.3) / 2, z);
  }
}
function vWall(group, colliders, x, zFrom, zTo, gaps = [], color = 0xf1f5f9) {
  let cur = zFrom;
  const segs = [];
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  for (const [g0, g1] of sorted) { segs.push([cur, g0]); cur = g1; }
  segs.push([cur, zTo]);
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue;
    const d = b - a, cz = (a + b) / 2;
    box(group, T, WALL_H, d, color, x, WALL_H / 2, cz, { cast: false });
    colliders.push({ minX: x - T / 2, maxX: x + T / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  for (const [g0, g1] of gaps) {
    box(group, T, WALL_H - 2.3, g1 - g0, color, x, 2.3 + (WALL_H - 2.3) / 2, (g0 + g1) / 2);
  }
}

// An open glass door panel parked against the wall beside a doorway.
function glassDoor(group, x, z, ry) {
  const p = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.25),
    new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide })
  );
  p.position.set(x, 1.13, z);
  p.rotation.y = ry;
  group.add(p);
  box(group, 0.05, 0.06, 0.5, 0x64748b, x, 1.15, z); // handle hint
}

function plant(group, x, z, s = 1) {
  cyl(group, 0.22 * s, 0.17 * s, 0.4 * s, 0xb45309, x, 0.2 * s, z);
  ball(group, 0.34 * s, 0x16a34a, x, 0.72 * s, z, { cast: true });
  ball(group, 0.26 * s, 0x22c55e, x + 0.18 * s, 0.6 * s, z + 0.1 * s);
  ball(group, 0.24 * s, 0x15803d, x - 0.17 * s, 0.62 * s, z - 0.12 * s);
}

function chair(group, x, z, ry, color = 0x334155) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  box(g, 0.46, 0.07, 0.44, color, 0, 0.46, 0, { cast: true });
  box(g, 0.46, 0.55, 0.07, color, 0, 0.78, -0.2);
  cyl(g, 0.04, 0.04, 0.44, 0x1f2937, 0, 0.22, 0);
  cyl(g, 0.26, 0.26, 0.03, 0x1f2937, 0, 0.02, 0);
  group.add(g);
  return g;
}

function monitor(group, x, y, z, ry, screenTex) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  box(g, 0.56, 0.36, 0.03, 0x111827, 0, 0.12, 0);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32),
    new THREE.MeshBasicMaterial({ map: screenTex }));
  scr.position.set(0, 0.12, 0.017);
  g.add(scr);
  box(g, 0.05, 0.12, 0.05, 0x111827, 0, -0.08, -0.02);
  box(g, 0.24, 0.02, 0.16, 0x111827, 0, -0.15, -0.02);
  group.add(g);
  return g;
}

const deskScreen = () => canvasTexture(256, 160, (g, w, h) => {
  g.fillStyle = '#f8fafc'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0284c7'; g.fillRect(0, 0, w, 22);
  g.fillStyle = '#cbd5e1';
  for (let i = 0; i < 6; i++) g.fillRect(14, 40 + i * 18, 120 + (i * 37) % 90, 8);
  g.fillStyle = '#fda4af'; g.fillRect(170, 96, 66, 46);
  g.fillStyle = '#86efac'; g.fillRect(14, 96, 66, 46);
});

export function buildOffice(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const addCollider = (x, z, w, d) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  // ---------- floors ----------
  const slab = box(group, 44.6, 0.12, 24.6, 0x9aa7b5, 0, -0.06, 0);
  slab.receiveShadow = true;
  const floor = (x, z, w, d, color) => {
    const f = box(group, w, 0.03, d, color, x, 0.015, z, { roughness: 0.95 });
    f.receiveShadow = true;
    return f;
  };
  floor(-18, 2, 8, 8, 0xfde9c8);        // reception - warm
  floor(-18, 9, 8, 6, 0xf3e3c0);        // manager office
  floor(-18, -7, 8, 10, 0xf8fafc);      // kitchen - tile
  floor(-13, 0, 2, 24, 0xdbe4ee);       // hallway
  floor(-2, 4.5, 20, 15, 0xd7e6f5);     // open plan
  floor(-9, -2.5, 6, 9, 0xe2e8f0);      // printer room
  floor(-6, -9.5, 12, 5, 0xfde3cf);     // lounge
  floor(7, -9, 14, 6, 0xd9f2f2);        // bathroom - aqua tile
  floor(11, 7, 6, 10, 0xc9d9f2);        // meeting room
  floor(11, -2, 6, 8, 0xdbe4ee);        // corridor
  floor(18, 3, 8, 18, 0xe6dcf5);        // game room

  // ---------- exterior walls ----------
  hWall(group, colliders, 12, -22, 22);
  hWall(group, colliders, -12, -22, 22);
  vWall(group, colliders, -22, -12, 12);
  vWall(group, colliders, 22, -12, 12);

  // windows on the north + south exterior walls (decorative glowing panels)
  const winMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff });
  for (const wx of [-18, -10, -2, 6, 14, 19]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), winMat);
    p.position.set(wx, 1.9, 11.86); p.rotation.y = Math.PI; group.add(p);
  }
  for (const wx of [-18, -6, 6, 16]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), winMat);
    p.position.set(wx, 1.9, -11.86); group.add(p);
  }

  // ---------- interior walls ----------
  vWall(group, colliders, -14, -12, 12, [[-7.6, -6.4], [1.4, 2.6], [8.3, 9.5]]);   // west block | hallway
  hWall(group, colliders, 6, -22, -14);                                            // manager | reception
  hWall(group, colliders, -2, -22, -14);                                           // reception | kitchen
  vWall(group, colliders, -12, -12, 12, [[-10.1, -8.9], [-2.6, -1.4], [8.0, 9.2]]); // hallway | east rooms
  hWall(group, colliders, 2, -12, -6);                                             // printer north
  vWall(group, colliders, -6, -7, 2, [[-2.6, -1.4]]);                              // printer east
  hWall(group, colliders, -7, -12, 0);                                             // printer/lounge north
  vWall(group, colliders, 0, -12, -6);                                             // lounge | bathroom
  hWall(group, colliders, -6, 0, 14, [[6.4, 7.6]]);                                // bathroom north
  vWall(group, colliders, 8, -7, 12, [[-2.6, -1.4], [6.4, 7.6]]);                  // open plan | meeting/corridor
  vWall(group, colliders, 14, -6, 12, [[-3.2, -2.0], [5.8, 7.0]]);                 // meeting/corridor | game room
  hWall(group, colliders, 2, 8, 14);                                               // meeting south

  // glass doors in the hallway (parked open against the wall)
  glassDoor(group, -12.45, 8.35, 0.35);
  glassDoor(group, -12.45, -1.75, 0.35);
  glassDoor(group, -12.45, -9.35, 0.35);
  glassDoor(group, -13.55, 2.35, Math.PI - 0.35);
  glassDoor(group, -13.55, 9.35, Math.PI - 0.35);
  glassDoor(group, -13.55, -6.75, Math.PI - 0.35);

  // ================= RECEPTION =================
  {
    const sign = textPlane('AGENT OFFICE', { w: 5.6, h: 1.0, font: 96, fg: '#0ea5e9', bg: '#0f2740' });
    sign.position.set(-21.83, 2.25, 2); sign.rotation.y = Math.PI / 2;
    group.add(sign);
    // reception desk
    box(group, 0.85, 1.08, 3.2, 0x0f766e, -20.1, 0.54, 2, { cast: true });
    box(group, 1.0, 0.06, 3.4, 0xf8fafc, -20.1, 1.11, 2);
    box(group, 0.7, 0.75, 2.6, 0x134e4a, -20.15, 0.37, 2);
    addCollider(-20.1, 2, 1.0, 3.4);
    const rsign = textPlane('RECEPTIONIST', { w: 1.9, h: 0.34, font: 64, fg: '#ffffff', bg: '#0f766e' });
    rsign.position.set(-19.56, 0.82, 2); rsign.rotation.y = Math.PI / 2;
    group.add(rsign);
    monitor(group, -20.25, 1.14, 1.2, Math.PI / 2, deskScreen());
    plant(group, -21.2, 5.4, 1.15);
    plant(group, -21.2, -1.3, 1.0);
    chair(group, -16.2, 0.2, -Math.PI / 2, 0x0f766e);
    chair(group, -16.2, 3.8, -Math.PI / 2, 0x0f766e);
    box(group, 0.9, 0.06, 2.6, 0xd6c9a8, -15.6, 0.02, 2); // waiting rug
  }

  // ================= MANAGER OFFICE (Olivia) =================
  {
    box(group, 2.2, 0.08, 1.0, 0x7c5a3a, -18.5, 0.74, 9.6, { cast: true });
    box(group, 0.08, 0.72, 0.9, 0x5b4028, -19.5, 0.37, 9.6);
    box(group, 0.08, 0.72, 0.9, 0x5b4028, -17.5, 0.37, 9.6);
    addCollider(-18.5, 9.6, 2.2, 1.0);
    monitor(group, -18.9, 0.78, 9.6, -Math.PI / 2, deskScreen());
    monitor(group, -18.1, 0.78, 9.6, -Math.PI / 2 + 0.5, deskScreen());
    box(group, 3.4, 2.0, 0.08, 0x8a6844, -18.5, 1.5, 11.9); // bookcase back board
    for (let i = 0; i < 9; i++)
      box(group, 0.22, 0.5 + (i % 3) * 0.12, 0.3, [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b][i % 4], -19.9 + i * 0.35, 0.85, 11.78);
    plant(group, -15.2, 11.3, 0.9);
  }

  // ================= OPEN PLAN CUBICLES =================
  const codeTexA = codeTexture(3), codeTexB = codeTexture(11);
  const cubicle = (x, z, faceSouth, code) => {
    box(group, 1.7, 0.07, 0.85, 0xe8edf3, x, 0.73, z, { cast: true });
    box(group, 1.7, 0.7, 0.06, 0x94a3b8, x, 0.37, z);
    box(group, 1.7, 0.55, 0.05, 0xb6c2d2, x, 1.05, z + (faceSouth ? 0.42 : -0.42)); // divider
    addCollider(x, z, 1.7, 0.85);
    const mry = faceSouth ? 0 : Math.PI;
    if (code) {
      monitor(group, x - 0.45, 0.77, z, mry + 0.25, codeTexA);
      monitor(group, x + 0.1, 0.77, z, mry, codeTexB);
      monitor(group, x + 0.6, 0.77, z, mry - 0.3, codeTexA);
    } else {
      monitor(group, x - 0.3, 0.77, z, mry + 0.2, deskScreen());
      monitor(group, x + 0.35, 0.77, z, mry - 0.15, deskScreen());
    }
    box(group, 0.4, 0.03, 0.28, 0x1f2937, x + 0.05, 0.78, z + (faceSouth ? 0.18 : -0.18)); // keyboard
  };
  // row A (z=5, chairs south side) / row B (z=9.5, chairs north side)
  const deskDefs = [
    { id: 'A1', x: -9.5, z: 5, face: Math.PI }, { id: 'A2', x: -5.5, z: 5, face: Math.PI },
    { id: 'A3', x: -1.5, z: 5, face: Math.PI }, { id: 'A4', x: 2.5, z: 5, face: Math.PI },
    { id: 'B1', x: -9.5, z: 9.5, face: 0 }, { id: 'B2', x: -5.5, z: 9.5, face: 0 },
    { id: 'B3', x: -1.5, z: 9.5, face: 0 }, { id: 'B4', x: 2.5, z: 9.5, face: 0 },
  ];
  for (const d of deskDefs) {
    const faceSouth = d.face === 0;
    cubicle(d.x, d.z, faceSouth, d.id === 'A3'); // A3 = Max, code monitors
    d.chairX = d.x; d.chairZ = d.z + (faceSouth ? -0.85 : 0.85);
    if (!['A2', 'A3', 'B1', 'B4'].includes(d.id)) chair(group, d.chairX, d.chairZ, d.face);
  }
  // big code screens on the north wall behind Max's row
  for (const wx of [-2.6, -0.4]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15), new THREE.MeshBasicMaterial({ map: codeTexB }));
    scr.position.set(wx, 1.9, 11.85); scr.rotation.y = Math.PI; group.add(scr);
    box(group, 2.0, 1.25, 0.06, 0x111827, wx, 1.9, 11.9);
  }
  plant(group, 7.2, 11.3, 1.1);
  plant(group, -11.3, 11.4, 0.95);
  plant(group, 7.3, -5.9, 0.9);

  // STOCKS poster on the meeting-room wall facing the open plan
  {
    const tex = canvasTexture(512, 640, (g, w, h) => {
      g.fillStyle = '#0b1e33'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f8fafc'; g.font = 'bold 92px Arial'; g.textAlign = 'center';
      g.fillText('STOCKS', w / 2, 110);
      g.strokeStyle = '#22c55e'; g.lineWidth = 10; g.beginPath();
      const pts = [[30, 520], [110, 470], [180, 495], [250, 400], [320, 420], [390, 300], [470, 190]];
      pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.stroke();
      g.fillStyle = '#22c55e';
      g.beginPath(); g.moveTo(470, 190); g.lineTo(430, 195); g.lineTo(462, 228); g.closePath(); g.fill();
      g.fillStyle = '#4ade80'; g.font = 'bold 54px Arial';
      g.fillText('+128%', w / 2, 600);
      g.strokeStyle = '#1e3a5f'; g.lineWidth = 2;
      for (let y = 180; y < 560; y += 60) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); }
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.85), new THREE.MeshBasicMaterial({ map: tex }));
    p.position.set(7.85, 1.8, 4.4); p.rotation.y = -Math.PI / 2; group.add(p);
    box(group, 0.05, 1.95, 1.6, 0x78350f, 7.9, 1.8, 4.4);
  }

  // ================= MEETING ROOM =================
  {
    box(group, 3.6, 0.09, 1.5, 0x8a6844, 11, 0.74, 7, { cast: true });
    box(group, 3.2, 0.7, 1.1, 0x6d4c2f, 11, 0.36, 7);
    addCollider(11, 7, 3.6, 1.5);
    for (const [cx, cz, ry] of [[9.7, 5.9, 0], [11, 5.9, 0], [12.3, 5.9, 0], [9.7, 8.1, Math.PI], [11, 8.1, Math.PI], [12.3, 8.1, Math.PI]])
      chair(group, cx, cz, ry, 0x1e40af);
    // chart on the east wall
    const chartTex = canvasTexture(512, 340, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0f2740'; g.font = 'bold 34px Arial'; g.textAlign = 'left';
      g.fillText('Q3 GROWTH', 26, 48);
      const bars = [70, 120, 95, 165, 210, 250];
      bars.forEach((bh, i) => {
        g.fillStyle = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#818cf8', '#22c55e'][i];
        g.fillRect(40 + i * 74, 300 - bh, 48, bh);
      });
      g.strokeStyle = '#94a3b8'; g.beginPath(); g.moveTo(30, 300); g.lineTo(w - 20, 300); g.stroke();
    });
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ map: chartTex }));
    chart.position.set(13.85, 1.85, 7); chart.rotation.y = -Math.PI / 2; group.add(chart);
    // whiteboard on the north wall
    const wb = textPlane('ROADMAP →', { w: 2.2, h: 1.1, font: 74, fg: '#334155', bg: '#ffffff' });
    wb.position.set(11, 1.8, 11.85); wb.rotation.y = Math.PI; group.add(wb);
    plant(group, 8.7, 11.3, 0.9);
  }

  // ================= PRINTER / COPY ROOM =================
  {
    const copier = (x, z) => {
      box(group, 0.95, 1.05, 0.7, 0xe5e7eb, x, 0.53, z, { cast: true });
      box(group, 0.8, 0.06, 0.55, 0x9ca3af, x, 1.09, z);
      box(group, 0.3, 0.18, 0.03, 0x38bdf8, x + 0.2, 0.92, z + 0.36);
      box(group, 0.7, 0.12, 0.5, 0xffffff, x, 0.35, z + 0.42); // paper tray
      addCollider(x, z, 0.95, 0.85);
    };
    copier(-9.5, -6.2);
    copier(-7.2, -6.2);
    box(group, 1.6, 0.75, 0.5, 0xd6c9a8, -10.8, 0.38, -3.5); // paper shelf
    box(group, 0.45, 0.3, 0.32, 0xffffff, -11, 0.9, -3.5);
    box(group, 0.45, 0.3, 0.32, 0xfef3c7, -10.4, 0.9, -3.5);
    addCollider(-10.8, -3.5, 1.6, 0.5);
    const lbl = textPlane('PRINT · COPY', { w: 1.7, h: 0.4, font: 62, fg: '#475569', bg: '#e2e8f0' });
    lbl.position.set(-9, 2.2, 1.85); lbl.rotation.y = Math.PI; group.add(lbl);
  }

  // ================= KITCHEN =================
  {
    box(group, 0.75, 0.9, 8.6, 0xd8cfc0, -21.5, 0.45, -7, { cast: true });   // counter run
    box(group, 0.8, 0.05, 8.6, 0x8a7a5f, -21.5, 0.93, -7);
    box(group, 0.6, 0.8, 8.6, 0xcabfa8, -21.65, 2.55, -7);                    // upper cabinets
    addCollider(-21.5, -7, 0.85, 8.6);
    // fridge
    box(group, 0.85, 1.95, 0.95, 0xdbe4ee, -21.45, 0.98, -11.2, { cast: true });
    box(group, 0.04, 0.5, 0.06, 0x64748b, -20.99, 1.15, -11.45);
    addCollider(-21.45, -11.2, 0.9, 1.0);
    // coffee machine on the counter
    box(group, 0.42, 0.5, 0.4, 0x1f2937, -21.5, 1.2, -4);
    cyl(group, 0.09, 0.11, 0.18, 0x78350f, -21.5, 1.04, -3.95);
    box(group, 0.16, 0.1, 0.16, 0xf8fafc, -21.35, 1.0, -4.35); // mug
    // microwave + sink
    box(group, 0.55, 0.35, 0.42, 0x9ca3af, -21.5, 1.13, -8);
    box(group, 0.5, 0.04, 0.7, 0x64748b, -21.5, 0.96, -6);
    // round table + chairs
    cyl(group, 0.75, 0.75, 0.05, 0xf8fafc, -17.6, 0.74, -7);
    cyl(group, 0.06, 0.06, 0.72, 0x64748b, -17.6, 0.37, -7);
    addCollider(-17.6, -7, 1.3, 1.3);
    chair(group, -16.7, -7, -Math.PI / 2, 0xb45309);
    chair(group, -18.5, -7, Math.PI / 2, 0xb45309);
    chair(group, -17.6, -8, Math.PI, 0xb45309);
    const lbl = textPlane('KITCHEN', { w: 1.5, h: 0.38, font: 66, fg: '#92400e', bg: '#fef3c7' });
    lbl.position.set(-18, 2.25, -1.85); group.add(lbl);
  }

  // ================= LOUNGE =================
  {
    const rug = cyl(group, 2.1, 2.1, 0.025, 0xdc2626, -6, 0.03, -9.5, { seg: 28 });
    rug.receiveShadow = true;
    // red beanbag
    const bean = ball(group, 0.62, 0xef4444, -8.2, 0.3, -10.2, { scale: [1, 0.62, 1], cast: true });
    addCollider(-8.2, -10.2, 1.1, 1.1);
    // sofa along the south wall
    box(group, 2.6, 0.45, 0.95, 0x64748b, -3.2, 0.23, -11.3, { cast: true });
    box(group, 2.6, 0.75, 0.25, 0x64748b, -3.2, 0.6, -11.65);
    box(group, 0.25, 0.35, 0.95, 0x475569, -4.55, 0.5, -11.3);
    box(group, 0.25, 0.35, 0.95, 0x475569, -1.85, 0.5, -11.3);
    box(group, 0.7, 0.12, 0.6, 0xef4444, -3.8, 0.52, -11.3); // cushions
    box(group, 0.7, 0.12, 0.6, 0xf59e0b, -2.6, 0.52, -11.3);
    addCollider(-3.2, -11.3, 2.7, 1.0);
    // coffee table + TV
    box(group, 1.1, 0.3, 0.55, 0x7c5a3a, -3.2, 0.15, -9.9);
    addCollider(-3.2, -9.9, 1.1, 0.55);
    const tvTex = canvasTexture(256, 144, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#7c3aed'); grad.addColorStop(1, '#0ea5e9');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = 'bold 34px Arial'; g.textAlign = 'center';
      g.fillText('CHILL TV', w / 2, h / 2 + 10);
    });
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.05), new THREE.MeshBasicMaterial({ map: tvTex }));
    tv.position.set(-3.2, 1.7, -7.14); group.add(tv);
    box(group, 2.0, 1.15, 0.05, 0x111827, -3.2, 1.7, -7.1);
    // wheelchair-access sign by the lounge door (pictogram drawn in canvas)
    const signTex = canvasTexture(256, 320, (g, w, h) => {
      g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 13; g.lineCap = 'round';
      g.beginPath(); g.arc(112, 208, 52, 0.6, 5.4); g.stroke();          // wheel
      g.beginPath(); g.arc(140, 62, 17, 0, Math.PI * 2); g.fill();        // head
      g.beginPath(); g.moveTo(138, 84); g.lineTo(128, 148); g.lineTo(178, 148); g.lineTo(196, 196); g.stroke(); // body/leg
      g.beginPath(); g.moveTo(132, 108); g.lineTo(168, 118); g.stroke();  // arm
      g.font = 'bold 30px Arial'; g.textAlign = 'center';
      g.fillText('ACCESSIBLE', w / 2, 292);
    });
    const wsign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), new THREE.MeshBasicMaterial({ map: signTex }));
    wsign.position.set(-11.85, 1.75, -9.5); wsign.rotation.y = Math.PI / 2; group.add(wsign);
    const lbl = textPlane('LOUNGE', { w: 1.4, h: 0.36, font: 66, fg: '#b91c1c', bg: '#fee2e2' });
    lbl.position.set(-6, 2.3, -7.14); lbl.rotation.y = Math.PI; group.add(lbl);
    plant(group, -11.3, -11.4, 1.0);
  }

  // ================= BATHROOM =================
  {
    // stalls along the south wall
    for (let i = 0; i < 4; i++) {
      const x0 = 1 + i * 3;
      box(group, 0.06, 2.1, 2.4, 0x94c5d8, x0, 1.05, -10.8);
      // toilet
      box(group, 0.5, 0.4, 0.42, 0xffffff, x0 + 1.5, 0.2, -11.55);
      cyl(group, 0.21, 0.17, 0.16, 0xffffff, x0 + 1.5, 0.48, -11.3);
      box(group, 0.5, 0.55, 0.14, 0xe2e8f0, x0 + 1.5, 0.85, -11.85);
    }
    box(group, 0.06, 2.1, 2.4, 0x94c5d8, 13, 1.05, -10.8);
    addCollider(7, -11.9, 12.2, 0.25);
    // stall doors (front, z=-9.6); stall 3 is OUT OF ORDER
    for (let i = 0; i < 4; i++) {
      const cx = 2.5 + i * 3;
      box(group, 2.2, 1.95, 0.05, i === 2 ? 0xb6bdc9 : 0x7fb3cc, cx, 0.98, -9.6);
      if (i === 2) {
        const s = textPlane('OUT OF ORDER', { w: 1.15, h: 0.3, font: 56, fg: '#ffffff', bg: '#dc2626' });
        s.position.set(cx, 1.35, -9.56); group.add(s);
      }
    }
    addCollider(7, -9.6, 12.2, 0.12);
    // sinks + mirrors along the north wall
    box(group, 4.6, 0.85, 0.6, 0xe8f4f8, 4, 0.43, -6.45, { cast: true });
    addCollider(4, -6.45, 4.6, 0.6);
    for (let i = 0; i < 3; i++) {
      cyl(group, 0.21, 0.16, 0.1, 0xffffff, 2.6 + i * 1.4, 0.88, -6.45);
      const mir = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xcfeef7, roughness: 0.05, metalness: 0.4 }));
      mir.position.set(2.6 + i * 1.4, 1.8, -5.86); group.add(mir);
    }
    const lbl = textPlane('WC', { w: 0.8, h: 0.36, font: 70, fg: '#0e7490', bg: '#cffafe' });
    lbl.position.set(10.5, 2.25, -5.85); group.add(lbl);
  }

  // ================= GAME ROOM =================
  {
    // foosball table
    const fb = new THREE.Group(); fb.position.set(18, 0, 2); group.add(fb);
    box(fb, 1.5, 0.55, 0.95, 0x065f46, 0, 0.55, 0, { cast: true });
    box(fb, 1.4, 0.04, 0.85, 0x22c55e, 0, 0.85, 0);
    for (let i = 0; i < 4; i++) {
      const rx = -0.55 + i * 0.36;
      const rod = cyl(fb, 0.02, 0.02, 1.35, 0xd1d5db, rx, 0.92, 0, { rx: Math.PI / 2 });
      for (let j = 0; j < 3; j++)
        box(fb, 0.07, 0.16, 0.05, i % 2 ? 0xdc2626 : 0x2563eb, rx, 0.78, -0.28 + j * 0.28);
      box(fb, 0.05, 0.05, 0.18, 0x111827, rx, 0.92, 0.75);
    }
    ball(fb, 0.045, 0xffffff, 0.1, 0.9, 0.1);
    addCollider(18, 2, 1.5, 1.0);
    // two pool tables
    const pool = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
      box(g, 2.5, 0.18, 1.35, 0x7c2d12, 0, 0.78, 0, { cast: true });
      box(g, 2.3, 0.05, 1.15, 0x15803d, 0, 0.89, 0);
      for (const [lx, lz] of [[-1.1, -0.55], [1.1, -0.55], [-1.1, 0.55], [1.1, 0.55]])
        box(g, 0.09, 0.78, 0.09, 0x451a03, lx, 0.39, lz);
      for (const [px, pz] of [[-1.12, -0.55], [0, -0.57], [1.12, -0.55], [-1.12, 0.55], [0, 0.57], [1.12, 0.55]])
        cyl(g, 0.055, 0.055, 0.02, 0x111827, px, 0.92, pz);
      ball(g, 0.04, 0xffffff, -0.5, 0.94, 0.1);
      ball(g, 0.04, 0xdc2626, 0.4, 0.94, -0.15);
      ball(g, 0.04, 0xf59e0b, 0.55, 0.94, 0.2);
      const cd = ry === 0 ? [2.5, 1.35] : [1.35, 2.5];
      addCollider(x, z, cd[0], cd[1]);
    };
    pool(20, 8.3, 0);
    pool(17.6, -4.2, Math.PI / 2);
    // arcade machines along the east wall
    const arcadeTex = (c1, c2, label) => canvasTexture(128, 160, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = 'bold 21px Arial'; g.textAlign = 'center';
      g.fillText(label, w / 2, 34);
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillRect(24, 56, 80, 56);
      g.fillStyle = c2; g.fillRect(34, 66, 60, 36);
    });
    const arcade = (z, c1, c2, label) => {
      box(group, 0.75, 1.8, 0.8, 0x1f2937, 21.5, 0.9, z, { cast: true });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.68),
        new THREE.MeshBasicMaterial({ map: arcadeTex(c1, c2, label) }));
      scr.position.set(21.11, 1.25, z); scr.rotation.y = -Math.PI / 2; scr.rotation.x = 0; group.add(scr);
      box(group, 0.06, 0.06, 0.12, 0xdc2626, 21.1, 0.78, z - 0.15);
      addCollider(21.5, z, 0.8, 0.85);
    };
    arcade(-0.8, '#f59e0b', '#dc2626', 'TURBO');
    arcade(0.6, '#2563eb', '#7c3aed', 'SPACE');
    arcade(5.6, '#16a34a', '#0ea5e9', 'KART');
    // dartboard on the north wall
    const dartTex = canvasTexture(256, 256, (g, w, h) => {
      const rings = ['#111827', '#f8fafc', '#111827', '#dc2626', '#16a34a', '#dc2626'];
      rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(128, 128, 126 - i * 19, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(128, 128, 14, 0, Math.PI * 2); g.fill();
    });
    const dart = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 28),
      new THREE.MeshBasicMaterial({ map: dartTex }));
    dart.rotation.x = Math.PI / 2; dart.rotation.z = Math.PI / 2;
    dart.position.set(18, 1.8, 11.86); group.add(dart);
    const lbl = textPlane('GAME ROOM', { w: 1.9, h: 0.4, font: 62, fg: '#6d28d9', bg: '#ede9fe' });
    lbl.position.set(18, 2.5, -5.85); group.add(lbl);
    plant(group, 15, 11.3, 0.9);
  }

  // ================= waypoint graph =================
  const N = {
    reception: [-18, 2], manager: [-18, 9], kitchen: [-18, -7],
    hTop: [-13, 8.5], hMid: [-13, 2], hLow: [-13, -2], hKit: [-13, -7], hBot: [-13, -9.5],
    openNW: [-8, 8.5], openNE: [4, 7], openC: [-2, 3], openSW: [-3, -2], openSE: [4, -2],
    printer: [-9, -2], lounge: [-6, -9.5],
    meeting: [11, 7], corridor: [11, -2], gameN: [18, 6], gameS: [18, -3],
  };
  const nodes = {};
  for (const [k, [x, z]] of Object.entries(N)) nodes[k] = new THREE.Vector3(x, 0, z);
  const edges = {
    reception: ['hMid'], manager: ['hTop'], kitchen: ['hKit'],
    hTop: ['manager', 'hMid', 'openNW'], hMid: ['reception', 'hTop', 'hLow'],
    hLow: ['hMid', 'hKit', 'printer'], hKit: ['kitchen', 'hLow', 'hBot'], hBot: ['hKit', 'lounge'],
    openNW: ['hTop', 'openNE', 'openC'], openNE: ['openNW', 'openC', 'meeting'],
    openC: ['openNW', 'openNE', 'openSW', 'openSE'], openSW: ['openC', 'openSE', 'printer'],
    openSE: ['openC', 'openSW', 'corridor'], printer: ['hLow', 'openSW'],
    lounge: ['hBot'], meeting: ['openNE', 'gameN'], corridor: ['openSE', 'gameS'],
    gameN: ['meeting', 'gameS'], gameS: ['gameN', 'corridor'],
  };
  function nearestNode(pos) {
    let best = null, bd = 1e9;
    for (const [k, v] of Object.entries(nodes)) {
      const d = (v.x - pos.x) ** 2 + (v.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function findPath(fromKey, toKey) {
    if (fromKey === toKey) return [fromKey];
    const prev = { [fromKey]: null };
    const q = [fromKey];
    while (q.length) {
      const cur = q.shift();
      for (const nb of edges[cur] || []) {
        if (!(nb in prev)) { prev[nb] = cur; q.push(nb); }
      }
    }
    if (!(toKey in prev)) return [fromKey];
    const path = [];
    let cur = toKey;
    while (cur) { path.unshift(cur); cur = prev[cur]; }
    return path;
  }

  // ================= landmarks =================
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  const landmarks = {
    desks: {
      Olivia: { spot: V(-18.5, 10.45), face: Math.PI, node: 'manager' },
      Leo: { spot: V(-5.5, 5.85), face: Math.PI, node: 'openC' },
      Max: { spot: V(-1.5, 5.85), face: Math.PI, node: 'openC' },
      Mia: { spot: V(2.5, 8.65), face: 0, node: 'openNE' },
      Sam: { spot: V(-9.5, 8.65), face: 0, node: 'openNW' },
    },
    coffee: V(-20.45, -4),
    meetingSeats: [V(9.7, 6.6), V(11, 6.6), V(12.3, 6.6), V(9.7, 7.4), V(12.3, 7.4)],
    printer: V(-8.6, -5.2),
    foosball: [V(17.05, 2), V(18.95, 2)],
    pool: V(18.6, -2.9),
    arcade: V(20.75, 0.6),
    plants: [V(-20.3, 4.6), V(6.5, 10.6), V(-10.6, -10.7)],
    loungeSpots: [V(-8.2, -9.2), V(-3.2, -10.5)],
    receptionDesk: V(-19.2, 2),
  };

  return { group, colliders, nodes, edges, nearestNode, findPath, landmarks };
}
