import * as THREE from 'three';
import { buildOffice } from './office.js';
import { Agent, AGENT_CONFIGS, GREETINGS, REPLIES, addBackgroundPeople, updateBackground } from './agents.js';
import { getModelName, setModelName, checkModel, chatWithModel } from './model.js';

// ---------------------------------------------------------------- renderer
const container = document.getElementById('scene-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8c6e0);
scene.fog = new THREE.Fog(0xa8c6e0, 70, 140);

const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 300);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8fa3b8, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
sun.position.set(18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 80;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ---------------------------------------------------------------- office + agents
const office = buildOffice(scene);
addBackgroundPeople(scene);

const $ = id => document.getElementById(id);
const logEl = $('event-log');
const now = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

function addLog(text) {
  const li = document.createElement('li');
  const ts = document.createElement('span');
  ts.className = 'ts'; ts.textContent = now();
  li.appendChild(ts);
  li.appendChild(document.createTextNode(text));
  logEl.appendChild(li);
  while (logEl.children.length > 90) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}

// stats state
let completedTasks = 0;
const runningBy = new Set();
const PROJECT_GOAL = 20;
function refreshStats() {
  const active = agents.filter(a => a.isActive() || a.paused).length;
  $('stat-active').textContent = `${active}/15`;
  $('stat-running').textContent = String(runningBy.size);
  $('stat-completed').textContent = String(completedTasks);
  const pct = Math.min(100, Math.round((completedTasks / PROJECT_GOAL) * 100));
  $('stat-progress').textContent = `${pct}%`;
  $('progress-fill').style.width = `${pct}%`;
}

const activityList = $('activity-list');
function renderActivity() {
  activityList.innerHTML = '';
  for (const a of agents) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot' + (a.isActive() || a.paused ? ' busy' : '');
    const who = document.createElement('span');
    who.className = 'who';
    who.innerHTML = `<b></b> <span class="role"></span>`;
    who.querySelector('b').textContent = a.name;
    who.querySelector('.role').textContent = `· ${a.role}`;
    const doing = document.createElement('span');
    doing.className = 'doing';
    doing.textContent = a.statusText;
    li.append(dot, who, doing);
    activityList.appendChild(li);
  }
}

const hooks = {
  log: addLog,
  status: () => { renderActivity(); refreshStats(); },
  taskStart: a => {
    runningBy.add(a.name);
    if (completedTasks === 0 && runningBy.size === 1) $('stat-project').textContent = 'Project: Nova Dashboard';
    refreshStats();
  },
  taskDone: a => {
    runningBy.delete(a.name);
    completedTasks++;
    addLog(`${a.name} completed a task.`);
    refreshStats();
  },
};

const agents = AGENT_CONFIGS.map(cfg => new Agent(scene, office, cfg, hooks));
renderActivity();
refreshStats();
addLog('The office is open. Agents are settling in.');
setInterval(() => { $('clock').textContent = now(); }, 500);
$('clock').textContent = now();

// ---------------------------------------------------------------- modes + cameras
let mode = 'overview';
// overview orbit state
const orbit = { theta: 0.65, phi: 0.92, radius: 37, target: new THREE.Vector3(0, 0, 0.5) };
// player state
const player = { pos: new THREE.Vector3(-15.2, 1.62, 2), yaw: -Math.PI / 2, pitch: 0 };
const LOUNGE_SPAWN = { pos: new THREE.Vector3(-2.2, 1.62, -8.0), yaw: -1.95, pitch: 0 };

function setMode(next, spawn) {
  mode = next;
  document.body.classList.toggle('walk-mode', next === 'walk');
  const activeTab = (next === 'walk' && spawn === 'lounge') ? 'lounge' : next;
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === activeTab));
  $('walk-hint').classList.toggle('hidden', next !== 'walk');
  $('crosshair').classList.toggle('hidden', next !== 'walk');
  if (next === 'walk') {
    if (spawn === 'lounge') { player.pos.copy(LOUNGE_SPAWN.pos); player.yaw = LOUNGE_SPAWN.yaw; player.pitch = 0; }
    else if (spawn === 'reception') { player.pos.set(-15.2, 1.62, 2); player.yaw = -Math.PI / 2; player.pitch = 0; }
  } else {
    closeChat();
    if (document.pointerLockElement) document.exitPointerLock();
    $('prompt').classList.add('hidden');
  }
}
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'overview') setMode('overview');
    else if (btn.dataset.tab === 'walk') setMode('walk', 'reception');
    else if (btn.dataset.tab === 'lounge') setMode('walk', 'lounge');
  });
});

// overview orbit input
let dragging = false, lastX = 0, lastY = 0, dragMoved = 0;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', e => {
  if (mode !== 'overview') return;
  dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('pointermove', e => {
  if (!dragging || mode !== 'overview') return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  orbit.theta -= dx * 0.005;
  orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.004, 0.35, 1.25);
});
window.addEventListener('pointerup', () => { dragging = false; });
cvs.addEventListener('wheel', e => {
  if (mode !== 'overview') return;
  e.preventDefault();
  orbit.radius = THREE.MathUtils.clamp(orbit.radius + e.deltaY * 0.03, 16, 58);
}, { passive: false });

// ---------------------------------------------------------------- walk-in controls
const keys = new Set();
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (mode === 'walk' && e.code === 'KeyE' && nearestAgent && !chatAgent) openChat(nearestAgent);
  if (e.code === 'Escape' && chatAgent) closeChat();
});
window.addEventListener('keyup', e => keys.delete(e.code));

cvs.addEventListener('click', () => {
  if (mode === 'walk' && !chatAgent && document.pointerLockElement !== cvs) cvs.requestPointerLock();
});
document.addEventListener('mousemove', e => {
  if (mode !== 'walk') return;
  if (document.pointerLockElement === cvs) {
    player.yaw -= e.movementX * 0.0022;
    player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.2, 1.2);
  }
});
// drag-look fallback when pointer lock is unavailable
let lookDrag = false;
cvs.addEventListener('pointerdown', e => { if (mode === 'walk') { lookDrag = true; lastX = e.clientX; lastY = e.clientY; } });
window.addEventListener('pointermove', e => {
  if (!lookDrag || mode !== 'walk' || document.pointerLockElement === cvs) return;
  player.yaw -= (e.clientX - lastX) * 0.005;
  player.pitch = THREE.MathUtils.clamp(player.pitch - (e.clientY - lastY) * 0.005, -1.2, 1.2);
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('pointerup', () => { lookDrag = false; });

function collide(pos, r) {
  for (const c of office.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        pos.x = (pos.x - (c.minX + c.maxX) / 2) < 0 ? c.minX - r : c.maxX + r;
      }
    }
  }
  pos.x = THREE.MathUtils.clamp(pos.x, -21.5, 21.5);
  pos.z = THREE.MathUtils.clamp(pos.z, -11.5, 11.5);
}

function updatePlayer(dt) {
  const speed = keys.has('ShiftLeft') ? 4.4 : 2.6;
  const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const str = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if ((fwd || str) && !chatAgent) {
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    player.pos.x += (sin * fwd + cos * str) * speed * dt;
    player.pos.z += (cos * fwd - sin * str) * speed * dt;
    collide(player.pos, 0.35);
  }
  camera.position.copy(player.pos);
  const look = new THREE.Vector3(
    player.pos.x + Math.sin(player.yaw) * Math.cos(player.pitch),
    player.pos.y + Math.sin(player.pitch),
    player.pos.z + Math.cos(player.yaw) * Math.cos(player.pitch)
  );
  camera.lookAt(look);
}

// ---------------------------------------------------------------- local model (Ollama)
let modelState = 'checking'; // 'ready' | 'not-pulled' | 'offline' | 'checking'
const MODEL_STATUS_TEXT = { ready: 'Connected', 'not-pulled': 'Not pulled', offline: 'Offline', checking: 'Checking…' };

function updateChatNote() {
  const note = $('chat-note');
  if (!note) return;
  if (modelState === 'ready' || modelState === 'checking') {
    note.classList.add('hidden');
    note.textContent = '';
  } else if (modelState === 'not-pulled') {
    note.textContent = `Offline scripted mode: ${getModelName()} is not pulled in Ollama, so ${chatAgent ? chatAgent.name : 'the agent'} is using scripted replies. Pull it with: ollama pull ${getModelName()}`;
    note.classList.remove('hidden');
  } else {
    note.textContent = `Offline scripted mode: Ollama is not reachable at localhost:11434, so ${chatAgent ? chatAgent.name : 'the agent'} is using scripted replies.`;
    note.classList.remove('hidden');
  }
}

async function refreshModelStatus() {
  const { state } = await checkModel();
  modelState = state;
  const name = getModelName();
  $('model-name').textContent = name;
  $('model-status').textContent = MODEL_STATUS_TEXT[state] || state;
  const dot = $('model-dot');
  dot.className = 'model-dot ' + state;
  updateChatNote();
  return state;
}
$('model-input').value = getModelName();
$('model-name').textContent = getModelName();
function applyModelInput() {
  setModelName($('model-input').value);
  $('model-input').value = getModelName();
  $('model-name').textContent = getModelName();
  modelState = 'checking';
  $('model-status').textContent = MODEL_STATUS_TEXT.checking;
  $('model-dot').className = 'model-dot checking';
  refreshModelStatus();
}
$('model-set').addEventListener('click', applyModelInput);
$('model-input').addEventListener('keydown', e => { if (e.key === 'Enter') applyModelInput(); });
refreshModelStatus();
setInterval(refreshModelStatus, 15000);

// ---------------------------------------------------------------- chat
let chatAgent = null;
let nearestAgent = null;
const replyIdx = {};
const chatLogged = new Set();
const chatHistory = {}; // agent name -> [{role, content}] for the local model

function chatMsg(text, who) {
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  $('chat-messages').appendChild(d);
  $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
  return d;
}
function openChat(agent) {
  chatAgent = agent;
  agent.paused = true;
  const prevStatus = agent.statusText;
  agent.setStatus('Chatting');
  $('chat-title').textContent = `${agent.name} · ${prevStatus === 'Chatting' ? 'Idle' : prevStatus}`;
  $('chat-input').placeholder = `Message ${agent.name}…`;
  $('chat-messages').innerHTML = '';
  $('chat-panel').classList.remove('hidden');
  $('prompt').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  chatMsg(GREETINGS[agent.name], 'them');
  refreshModelStatus(); // recheck Ollama every time a chat opens
  setTimeout(() => $('chat-input').focus(), 60);
}
function closeChat() {
  if (!chatAgent) { $('chat-panel').classList.add('hidden'); return; }
  chatAgent.paused = false;
  chatAgent.setStatus(chatAgent.activity ? chatAgent.activity.label : 'Idle');
  chatAgent = null;
  $('chat-panel').classList.add('hidden');
}
function scriptedReply(agent, hist) {
  const idx = (replyIdx[agent.name] = (replyIdx[agent.name] || 0) + 1);
  const line = REPLIES[agent.name][(idx - 1) % REPLIES[agent.name].length];
  setTimeout(() => {
    hist.push({ role: 'assistant', content: line });
    if (chatAgent === agent) chatMsg(line, 'them');
  }, 750);
}

async function sendChat() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text || !chatAgent) return;
  chatMsg(text, 'me');
  input.value = '';
  const agent = chatAgent;
  if (!chatLogged.has(agent.name)) { addLog(`Chatting with ${agent.name}.`); chatLogged.add(agent.name); }
  const hist = (chatHistory[agent.name] = chatHistory[agent.name] || []);
  hist.push({ role: 'user', content: text });

  if (modelState !== 'ready') { scriptedReply(agent, hist); return; }

  const typing = chatMsg(`${agent.name} is typing`, 'them typing');
  try {
    const reply = await chatWithModel(agent, hist);
    typing.remove();
    hist.push({ role: 'assistant', content: reply });
    if (chatAgent === agent) chatMsg(reply, 'them');
  } catch (err) {
    // Ollama went away mid-chat: fall back to scripted replies, honestly.
    typing.remove();
    console.warn('Local model chat failed, using scripted reply:', err);
    refreshModelStatus();
    scriptedReply(agent, hist);
  }
}
$('chat-send').addEventListener('click', sendChat);
$('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
$('chat-close').addEventListener('click', closeChat);

// ---------------------------------------------------------------- main loop
const clockT = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clockT.getDelta(), 0.1);
  const t = clockT.elapsedTime;

  for (const a of agents) a.update(dt);
  updateBackground(t);

  if (mode === 'overview') {
    const { theta, phi, radius, target } = orbit;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
    $('prompt').classList.add('hidden');
  } else {
    updatePlayer(dt);
    // proximity prompt
    nearestAgent = null;
    let best = 2.3;
    for (const a of agents) {
      const d = a.group.position.distanceTo(player.pos);
      if (d < best) { best = d; nearestAgent = a; }
    }
    const prompt = $('prompt');
    if (nearestAgent && !chatAgent) {
      prompt.innerHTML = `<b>[E]</b>&nbsp; to talk to ${nearestAgent.name} (${nearestAgent.role} Agent)`;
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  }
  for (const a of agents) a.updateLabel(camera);
  renderer.render(scene, camera);
}
tick();

// small handle for automated QA / debugging
window.__app = { agents, player, setMode, openChat, scene,
  model: { state: () => modelState, refresh: refreshModelStatus, name: getModelName } };

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
