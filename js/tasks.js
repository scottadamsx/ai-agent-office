// ---------------------------------------------------------------------------
// Real task system.
//
// A task is created on the board, then actually executed through the local
// Ollama model with a role-specific system prompt. The model's output is the
// task's deliverable and is stored, with the task, in a persistent work
// record (localStorage). The event log is fed ONLY by real task events:
// created, started, completed (with a summary from the actual output), and
// failed (with the real reason). If Ollama is unreachable, tasks fail
// visibly. Nothing here simulates or fake-completes work.
// ---------------------------------------------------------------------------
import { getModelName, runTaskWithModel, completeWithModel } from './model.js';

export const AGENTS = [
  { name: 'Olivia', role: 'Manager' },
  { name: 'Leo', role: 'Researcher' },
  { name: 'Max', role: 'Developer' },
  { name: 'Mia', role: 'Designer' },
  { name: 'Sam', role: 'Assistant' },
];
export const AUTO = 'Auto';

const TASKS_KEY = 'ai-office-tasks-v1';
const EVENTS_KEY = 'ai-office-events-v1';
const EVENT_CAP = 200;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) { const v = JSON.parse(raw); if (Array.isArray(v)) return v; }
  } catch { /* storage unavailable or corrupt: start clean */ }
  return fallback;
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const tasks = load(TASKS_KEY, []);
const events = load(EVENTS_KEY, []);

const listeners = new Set();
export function onTasksChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(); }

export function listTasks() { return tasks.slice().reverse(); } // newest first
export function listEvents() { return events.slice(); }
export function taskCounts() {
  const c = { queued: 0, running: 0, done: 0, failed: 0, total: tasks.length };
  for (const t of tasks) if (c[t.status] !== undefined) c[t.status]++;
  return c;
}

function pushEvent(type, text, ts = Date.now()) {
  events.push({ ts, type, text });
  while (events.length > EVENT_CAP) events.shift();
  save(EVENTS_KEY, events);
}

// A task left 'running' when the page closed was interrupted mid-run. Mark it
// failed with the honest reason instead of pretending it finished.
for (const t of tasks) {
  if (t.status === 'running' || t.status === 'queued') {
    const was = t.status;
    t.status = 'failed';
    t.error = was === 'running'
      ? 'Interrupted: the page closed while this task was running.'
      : 'Interrupted: the page closed before this task ran.';
    t.finishedAt = Date.now();
    pushEvent('failed', `Task failed: "${t.title}" — ${t.error}`, t.finishedAt);
  }
}
save(TASKS_KEY, tasks);

let idSeq = 0;
function newId() {
  return `t${Date.now().toString(36)}${(idSeq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function createTask({ title, instructions, assignee }) {
  const task = {
    id: newId(),
    title: String(title || '').trim() || 'Untitled task',
    instructions: String(instructions || '').trim(),
    assignee: assignee || AUTO,
    agent: null,
    status: 'queued',
    output: '',
    summary: '',
    error: '',
    model: getModelName(),
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
  tasks.push(task);
  save(TASKS_KEY, tasks);
  pushEvent('created',
    `Task created: "${task.title}"${task.assignee !== AUTO ? ` for ${task.assignee}` : ' (unassigned)'}`,
    task.createdAt);
  emit();
  pump();
  return task;
}

// ---------------------------------------------------------------------------
// Execution: one task at a time, through the real model.
// ---------------------------------------------------------------------------
let running = false;
let hooks = { onRunStart: () => {}, onRunEnd: () => {} };
export function setTaskHooks(h) { hooks = { ...hooks, ...h }; }

function roleOf(name) {
  const a = AGENTS.find(a => a.name === name);
  return a ? a.role : 'Team member';
}

function readableError(err) {
  if (!err) return 'Unknown error';
  if (err.name === 'AbortError') return 'Timed out waiting for the local model to respond.';
  const msg = err.message || String(err);
  if (/failed to fetch|networkerror|load failed|connection/i.test(msg)) {
    return 'Ollama is not reachable at localhost:11434 (local model offline).';
  }
  return msg;
}

function firstLineSummary(output) {
  const lines = (output || '').split('\n')
    .map(s => s.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim())
    .filter(s => s.length > 3 && !/^(python|javascript|js|html|css|bash|sh|json|text)$/i.test(s));
  const line = lines.find(s => s.length >= 15) || lines[0] || 'Done';
  return line.length > 110 ? `${line.slice(0, 107)}…` : line;
}

// Unassigned tasks go to Olivia first: she picks the agent through the model.
async function assignWithOlivia(task) {
  const names = AGENTS.map(a => `${a.name} (${a.role})`).join(', ');
  const reply = await completeWithModel(
    'You are Olivia, the manager of a small software office, routing a task to the right person. '
    + `The team is: ${names}. Reply with exactly one first name and nothing else.`,
    `Task title: ${task.title}\nInstructions: ${task.instructions || '(none)'}`,
    { numPredict: 16, temperature: 0 });
  const hit = AGENTS.find(a => reply.includes(a.name));
  return hit ? hit.name : 'Olivia';
}

async function execute(task) {
  let agentName = task.assignee;
  if (agentName === AUTO) {
    try { agentName = await assignWithOlivia(task); }
    catch { agentName = 'Olivia'; } // routing failed; Olivia takes it and the run surfaces any real error
  }
  task.agent = agentName;
  task.status = 'running';
  task.startedAt = Date.now();
  task.model = getModelName();
  save(TASKS_KEY, tasks);
  pushEvent('started', `${agentName} started task: "${task.title}"`, task.startedAt);
  emit();
  hooks.onRunStart(agentName, task);
  try {
    const output = await runTaskWithModel(agentName, roleOf(agentName), task);
    task.output = output;
    task.summary = firstLineSummary(output);
    task.status = 'done';
    task.finishedAt = Date.now();
    pushEvent('completed', `${agentName} completed task: "${task.title}" — ${task.summary}`, task.finishedAt);
  } catch (err) {
    task.status = 'failed';
    task.error = readableError(err);
    task.finishedAt = Date.now();
    pushEvent('failed', `Task failed: "${task.title}" — ${task.error}`, task.finishedAt);
  }
  save(TASKS_KEY, tasks);
  emit();
  hooks.onRunEnd(agentName, task);
}

async function pump() {
  if (running) return;
  const next = tasks.find(t => t.status === 'queued');
  if (!next) return;
  running = true;
  try { await execute(next); }
  finally { running = false; }
  pump();
}

// Resume anything queued (e.g. created in a previous session is failed above,
// so this is just a safety no-op in practice).
pump();
