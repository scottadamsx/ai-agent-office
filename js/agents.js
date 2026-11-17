import * as THREE from 'three';
import { mat, box, cyl, ball, canvasTexture, nameLabel } from './util.js';

const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const faceToward = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const _labelV = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Stylized person built from primitives. Model faces +Z at rotation.y = 0.
// ---------------------------------------------------------------------------
export function createPerson(cfg) {
  const g = new THREE.Group();
  const seated = !!cfg.seated;
  const hipY = seated ? 0.48 : 0.74;

  if (seated) {
    box(g, 0.15, 0.14, 0.44, cfg.pants, -0.095, 0.47, 0.2, { cast: true });  // thighs
    box(g, 0.15, 0.14, 0.44, cfg.pants, 0.095, 0.47, 0.2, { cast: true });
    box(g, 0.14, 0.46, 0.14, cfg.pants, -0.095, 0.23, 0.4);                 // shins
    box(g, 0.14, 0.46, 0.14, cfg.pants, 0.095, 0.23, 0.4);
  } else {
    box(g, 0.15, 0.74, 0.17, cfg.pants, -0.095, 0.37, 0, { cast: true });   // legs
    box(g, 0.15, 0.74, 0.17, cfg.pants, 0.095, 0.37, 0, { cast: true });
    box(g, 0.17, 0.07, 0.26, 0x1f2937, -0.095, 0.035, 0.03);                // shoes
    box(g, 0.17, 0.07, 0.26, 0x1f2937, 0.095, 0.035, 0.03);
  }

  const torsoY = hipY + 0.31;
  box(g, 0.46, 0.62, 0.25, cfg.shirt, 0, torsoY, 0, { cast: true });        // torso
  if (cfg.shirtText) {
    const tex = canvasTexture(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#22d3ee'; c.font = 'bold 52px monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(cfg.shirtText, w / 2, h / 2);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    p.position.set(0, torsoY + 0.02, 0.128);
    g.add(p);
  }

  // arms (pivot at the shoulder)
  const mkArm = side => {
    const a = new THREE.Group();
    a.position.set(0.29 * side, torsoY + 0.26, 0);
    box(a, 0.11, 0.56, 0.11, cfg.shirt, 0, -0.24, 0, { cast: true });
    ball(a, 0.055, cfg.skin, 0, -0.53, 0);
    if (seated) a.rotation.x = -0.95;
    g.add(a);
    return a;
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // head + hair
  const headG = new THREE.Group();
  headG.position.set(0, torsoY + 0.31, 0);
  g.add(headG);
  ball(headG, 0.155, cfg.skin, 0, 0.14, 0, { cast: true });
  if (cfg.hairStyle === 'long') {
    ball(headG, 0.165, cfg.hair, 0, 0.19, -0.02, { scale: [1, 0.82, 1] });
    box(headG, 0.3, 0.52, 0.09, cfg.hair, 0, -0.08, -0.125);
  } else if (cfg.hairStyle === 'bun') {
    ball(headG, 0.162, cfg.hair, 0, 0.19, -0.015, { scale: [1, 0.8, 1] });
    ball(headG, 0.085, cfg.hair, 0, 0.3, -0.1);
  } else {
    ball(headG, 0.163, cfg.hair, 0, 0.185, -0.012, { scale: [1, 0.78, 1] });
  }
  if (cfg.beard) box(headG, 0.21, 0.13, 0.05, cfg.hair, 0, 0.015, 0.125);
  if (cfg.glasses) {
    const gm = new THREE.MeshBasicMaterial({ color: 0x111827 });
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 8, 20), gm);
      ring.position.set(0.076 * s, 0.155, 0.148);
      headG.add(ring);
    }
    box(headG, 0.05, 0.015, 0.015, 0x111827, 0, 0.155, 0.148, { material: gm });
  }
  if (cfg.headphones) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.028, 8, 20, Math.PI),
      mat(0x111827, { roughness: 0.5 }));
    band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI / 2;
    band.position.set(0, -0.06, 0);
    headG.add(band);
    cyl(headG, 0.055, 0.055, 0.04, 0x111827, -0.17, -0.13, 0, { rz: Math.PI / 2 });
    cyl(headG, 0.055, 0.055, 0.04, 0x111827, 0.17, -0.13, 0, { rz: Math.PI / 2 });
  }

  let label = null;
  if (cfg.name) {
    label = nameLabel(cfg.name);
    label.position.set(0, (seated ? 1.62 : 2.02), 0);
    g.add(label);
  }
  g.userData = { armL, armR, headG, label };
  return g;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
const ACTIVITIES = [
  { id: 'work', label: 'Working', phrase: 'Typing at their desk.', task: true, weight: 42, dur: [9, 16], anim: 'type',
    spot: (a, o) => { const d = o.landmarks.desks[a.name]; return { pos: d.spot, node: d.node, face: d.face }; } },
  { id: 'coffee', label: 'Getting coffee', phrase: 'Drinking a coffee.', weight: 12, dur: [5, 8], anim: 'drink',
    spot: (a, o) => ({ pos: o.landmarks.coffee, node: 'kitchen', face: -Math.PI / 2 }) },
  { id: 'meeting', label: 'In a meeting', phrase: 'In a meeting.', task: true, weight: 10, dur: [8, 13], anim: 'stand',
    spot: (a, o) => { const s = pick(o.landmarks.meetingSeats); return { pos: s, node: 'meeting', face: faceToward(s, { x: 11, z: 7 }) }; } },
  { id: 'printer', label: 'Printing', phrase: 'Printing documents.', task: true, weight: 8, dur: [5, 7], anim: 'stand',
    spot: (a, o) => ({ pos: o.landmarks.printer, node: 'printer', face: Math.PI }) },
  { id: 'foosball', label: 'Playing foosball', phrase: 'Playing foosball.', weight: 7, dur: [6, 9], anim: 'play',
    spot: (a, o) => { const s = pick(o.landmarks.foosball); return { pos: s, node: 'gameS', face: faceToward(s, { x: 18, z: 2 }) }; } },
  { id: 'pool', label: 'Playing pool', phrase: 'Playing pool.', weight: 5, dur: [6, 9], anim: 'play',
    spot: (a, o) => ({ pos: o.landmarks.pool, node: 'gameS', face: faceToward(o.landmarks.pool, { x: 17.6, z: -4.2 }) }) },
  { id: 'arcade', label: 'At the arcade', phrase: 'Playing an arcade game.', weight: 5, dur: [5, 8], anim: 'play',
    spot: (a, o) => ({ pos: o.landmarks.arcade, node: 'gameS', face: Math.PI / 2 }) },
  { id: 'plants', label: 'Watering plants', phrase: 'Watering the plants.', weight: 5, dur: [5, 7], anim: 'stand',
    spot: (a, o) => { const i = Math.floor(Math.random() * o.landmarks.plants.length); return { pos: o.landmarks.plants[i], node: ['reception', 'openNE', 'lounge'][i], face: rand(0, Math.PI * 2) }; } },
  { id: 'lounge', label: 'Relaxing', phrase: 'Relaxing in the lounge.', weight: 6, dur: [6, 10], anim: 'stand',
    spot: (a, o) => { const s = pick(o.landmarks.loungeSpots); return { pos: s, node: 'lounge', face: faceToward(s, { x: -6, z: -9.5 }) }; } },
];
const TOTAL_WEIGHT = ACTIVITIES.reduce((s, a) => s + a.weight, 0);
function pickActivity() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const a of ACTIVITIES) { r -= a.weight; if (r <= 0) return a; }
  return ACTIVITIES[0];
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------
export class Agent {
  constructor(scene, office, cfg, hooks) {
    this.office = office;
    this.hooks = hooks;
    this.name = cfg.name;
    this.role = cfg.role;
    this.group = createPerson(cfg);
    this.label = this.group.userData.label || null;
    const desk = office.landmarks.desks[cfg.name];
    this.group.position.copy(desk.spot);
    this.group.rotation.y = desk.face;
    this.faceTarget = desk.face;
    scene.add(this.group);
    this.state = 'idle';
    this.timer = rand(0.6, 3.2); // staggered starts so the office wakes up gradually
    this.statusText = 'Idle';
    this.path = [];
    this.pending = null;
    this.activity = null;
    this.paused = false;
    this.animT = Math.random() * 10;
  }

  setStatus(txt) {
    if (txt === this.statusText) return;
    this.statusText = txt;
    this.hooks.status(this);
  }

  // Name labels are sprites with a fixed world size, so up close they balloon
  // across the screen. Scale them with camera distance (clamped, so they stay
  // readable a few metres away and in Overview) and fade them out point-blank.
  updateLabel(camera) {
    if (!this.label) return;
    const p = this.label.getWorldPosition(_labelV);
    const d = p.distanceTo(camera.position);
    const s = THREE.MathUtils.clamp(d / 4.5, 0.3, 1.5);
    this.label.scale.set(1.35 * s, 0.34 * s, 1);
    const fade = THREE.MathUtils.clamp((d - 1.0) / 0.7, 0, 1);
    this.label.material.opacity = fade;
    this.label.visible = fade > 0.02;
  }
  isActive() { return this.state !== 'idle'; }

  goTo(spotPos, nodeKey, onArrive) {
    const from = this.office.nearestNode(this.group.position);
    const keys = this.office.findPath(from, nodeKey);
    this.path = keys.map(k => this.office.nodes[k].clone());
    const last = this.path[this.path.length - 1];
    if (!last || last.distanceTo(spotPos) > 0.01) this.path.push(spotPos.clone());
    this.onArrive = onArrive;
    this.state = 'walk';
    this.setStatus('Walking');
  }

  pickNext() {
    const act = pickActivity();
    const s = act.spot(this, this.office);
    this.pending = { act, face: s.face };
    this.goTo(s.pos, s.node, () => this.beginActivity(act, s.face));
  }

  beginActivity(act, face) {
    this.activity = act;
    this.faceTarget = face;
    this.state = 'act';
    this.timer = rand(act.dur[0], act.dur[1]);
    this.setStatus(act.label);
    this.hooks.log(`${this.name}: ${act.phrase}`);
    if (act.task) this.hooks.taskStart(this);
  }

  finishActivity() {
    if (this.activity?.task) this.hooks.taskDone(this);
    this.activity = null;
    this.state = 'idle';
    this.timer = rand(0.8, 2.6);
    this.setStatus('Idle');
  }

  update(dt) {
    this.animT += dt;
    const { armL, armR } = this.group.userData;
    if (this.paused) { armL.rotation.x *= 0.9; armR.rotation.x *= 0.9; return; }

    if (this.state === 'idle') {
      this.group.rotation.y = lerpAngle(this.group.rotation.y, this.faceTarget, dt * 4);
      armL.rotation.x *= 0.85; armR.rotation.x *= 0.85;
      this.timer -= dt;
      if (this.timer <= 0) this.pickNext();
    } else if (this.state === 'walk') {
      const target = this.path[0];
      if (!target) { this.state = 'idle'; this.timer = 0.5; return; }
      const p = this.group.position;
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = 1.7 * dt;
      if (dist <= Math.max(step, 0.05)) {
        p.x = target.x; p.z = target.z;
        this.path.shift();
        if (!this.path.length && this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(); }
      } else {
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        this.faceTarget = Math.atan2(dx, dz);
      }
      this.group.rotation.y = lerpAngle(this.group.rotation.y, this.faceTarget, dt * 10);
      const sw = Math.sin(this.animT * 9) * 0.55;
      armL.rotation.x = sw; armR.rotation.x = -sw;
      this.group.position.y = Math.abs(Math.sin(this.animT * 9)) * 0.035;
    } else if (this.state === 'act') {
      this.group.position.y = 0;
      this.group.rotation.y = lerpAngle(this.group.rotation.y, this.faceTarget, dt * 5);
      const anim = this.activity?.anim;
      if (anim === 'type') {
        armL.rotation.x = -0.85 + Math.sin(this.animT * 13) * 0.08;
        armR.rotation.x = -0.85 + Math.cos(this.animT * 15) * 0.08;
      } else if (anim === 'drink') {
        armL.rotation.x *= 0.9;
        armR.rotation.x = -1.9 + Math.sin(this.animT * 1.4) * 0.25;
      } else if (anim === 'play') {
        const sw = Math.sin(this.animT * 3.2) * 0.3;
        armL.rotation.x = -0.5 + sw; armR.rotation.x = -0.5 - sw;
        this.group.position.x += Math.sin(this.animT * 3.2) * 0.0015;
      } else {
        armL.rotation.x = Math.sin(this.animT * 1.6) * 0.05;
        armR.rotation.x = -Math.sin(this.animT * 1.6) * 0.05;
      }
      this.timer -= dt;
      if (this.timer <= 0) this.finishActivity();
    }
  }
}

export const AGENT_CONFIGS = [
  { name: 'Olivia', role: 'Manager', skin: 0xf2c9a0, hair: 0xf5d76e, hairStyle: 'long', shirt: 0x1e3a5f, pants: 0x374151 },
  { name: 'Leo', role: 'Researcher', skin: 0xc68863, hair: 0x3f2d20, hairStyle: 'cap', shirt: 0x16a34a, pants: 0x1f2937 },
  { name: 'Max', role: 'Developer', skin: 0xe8b48c, hair: 0x241a12, hairStyle: 'cap', shirt: 0x111827, pants: 0x111827, beard: true, glasses: true, headphones: true, shirtText: '</>' },
  { name: 'Mia', role: 'Designer', skin: 0x8d5524, hair: 0x14100e, hairStyle: 'bun', shirt: 0x9333ea, pants: 0x312e81 },
  { name: 'Sam', role: 'Assistant', skin: 0xffdbac, hair: 0x0f0f0f, hairStyle: 'cap', shirt: 0xf59e0b, pants: 0x065f46 },
];

export const GREETINGS = {
  Olivia: "Hi! I'm Olivia, I manage the team here. We're pushing on the Nova Dashboard today.",
  Leo: "Hey there. Leo, research. I dig up the facts so the rest of the team doesn't have to guess.",
  Max: "Oh, hey. Max, developer. Mind the code screens, that's my natural habitat.",
  Mia: "Hello! Mia, design. If it looks good around here, I probably had something to do with it.",
  Sam: "Hi hi! Sam, assistant. Coffee runs, calendars, chaos control. That's me.",
};

export const REPLIES = {
  Olivia: [
    "We're on track. Two tasks closed this morning and the Nova Dashboard is taking shape.",
    "If you need anything, start with Sam, he knows where everything lives. Even the good pens.",
    "Stand-up is at ten. Short, sharp, and nobody is allowed to say 'synergy'.",
  ],
  Leo: [
    "I just read a fascinating paper on office plant productivity. The plants are winning.",
    "My latest research says meetings could be emails. Groundbreaking, I know.",
    "Give me a question and twenty minutes. I'll come back with charts.",
  ],
  Max: [
    "I fixed a bug today that I created yesterday. Net progress: zero. Morale: high.",
    "The build is green, the coffee is black, and the code is… mostly commented.",
    "Have you tried turning it off and on again? Works on printers and Mondays.",
  ],
  Mia: [
    "I'm redoing the dashboard palette. Forty shades of blue and one brave coral.",
    "Kerning is just spacing with feelings. I have many feelings about spacing.",
    "If the button doesn't spark joy, it doesn't ship. Those are the rules.",
  ],
  Sam: [
    "I've restocked the snack drawer twice today. Twice. Heroes don't always wear capes.",
    "Your calendar is clear, your coffee is hot, and the printer fears me. All is well.",
    "I alphabetized the supply closet. Please clap.",
  ],
};

// ---------------------------------------------------------------------------
// Background people (unnamed, seated) so the office feels populated.
// ---------------------------------------------------------------------------
const bgHeads = [];
export function addBackgroundPeople(scene) {
  const mk = (cfg, x, z, face) => {
    const p = createPerson({ ...cfg, seated: true });
    p.position.set(x, 0, z);
    p.rotation.y = face;
    scene.add(p);
    bgHeads.push(p.userData.headG);
    return p;
  };
  // receptionist behind the reception desk, facing the door (east)
  mk({ skin: 0xe8b48c, hair: 0x5b3a1e, hairStyle: 'bun', shirt: 0x0f766e, pants: 0x134e4a }, -20.85, 2, Math.PI / 2);
  // cubicle workers at the unassigned desks
  mk({ skin: 0xc68863, hair: 0x111111, hairStyle: 'cap', shirt: 0x2563eb, pants: 0x1f2937 }, -9.5, 5.85, Math.PI);
  mk({ skin: 0xffdbac, hair: 0x7c2d12, hairStyle: 'cap', shirt: 0xdb2777, pants: 0x374151 }, 2.5, 5.85, Math.PI);
  mk({ skin: 0x8d5524, hair: 0x000000, hairStyle: 'long', shirt: 0x0891b2, pants: 0x1e293b }, -5.5, 8.65, 0);
  mk({ skin: 0xf2c9a0, hair: 0x3f2d20, hairStyle: 'cap', shirt: 0x65a30d, pants: 0x44403c }, -1.5, 8.65, 0);
}
export function updateBackground(t) {
  bgHeads.forEach((h, i) => { h.rotation.y = Math.sin(t * 0.6 + i * 1.7) * 0.16; });
}
