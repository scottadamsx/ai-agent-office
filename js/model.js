// ---------------------------------------------------------------------------
// Local model layer: talks to Ollama on the same machine the browser runs on.
//
//   GET  http://localhost:11434/api/tags   -> which models are pulled
//   POST http://localhost:11434/api/chat   -> chat completions
//
// The default model is Qwen3 8B (qwen3:8b), the most pulled current Qwen on
// Ollama. The name can be changed in the left-panel settings and is kept in
// localStorage, so any other local model works without code changes.
// ---------------------------------------------------------------------------

export const OLLAMA_BASE = 'http://localhost:11434';
export const DEFAULT_MODEL = 'qwen3:8b';
const STORAGE_KEY = 'ai-office-model';

export function getModelName() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch { /* storage unavailable (private mode etc.) */ }
  return DEFAULT_MODEL;
}

export function setModelName(name) {
  const clean = String(name || '').trim();
  if (!clean) return getModelName();
  try { localStorage.setItem(STORAGE_KEY, clean); } catch { /* ignore */ }
  return clean;
}

function fetchTimeout(url, options = {}, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Health: 'ready' | 'not-pulled' | 'offline'
// ---------------------------------------------------------------------------
export async function checkModel() {
  const name = getModelName();
  let data;
  try {
    const res = await fetchTimeout(`${OLLAMA_BASE}/api/tags`, {}, 4000);
    if (!res.ok) return { state: 'offline', name };
    data = await res.json();
  } catch {
    return { state: 'offline', name };
  }
  const pulled = (data.models || []).map(m => m.name);
  const want = name.includes(':') ? name : `${name}:latest`;
  return { state: pulled.includes(want) ? 'ready' : 'not-pulled', name, pulled };
}

// ---------------------------------------------------------------------------
// Per-agent personalities for the system prompt.
// ---------------------------------------------------------------------------
const PERSONAS = {
  Olivia: 'You are Olivia, the manager of a small, friendly software office. You coordinate the team and are currently pushing the "Nova Dashboard" project toward launch. You are organised, warm and a little dry-humoured, and you like short stand-ups and clear next steps.',
  Leo: 'You are Leo, the researcher in a small, friendly software office. You dig up facts, read papers and build charts so the team does not have to guess. You are curious, precise and gently nerdy, and you enjoy a surprising statistic.',
  Max: 'You are Max, the developer in a small, friendly software office. You write the code, ship features and fix bugs (some of them your own). You are laid-back and self-deprecating, you joke about programming, printers and coffee, and your build is usually green.',
  Mia: 'You are Mia, the designer in a small, friendly software office. You own the look and feel of everything the team ships. You are cheerful and playful, with strong opinions about colour palettes, typography and spacing.',
  Sam: 'You are Sam, the assistant in a small, friendly software office. You handle coffee runs, calendars, supplies and general chaos control. You are upbeat, eager and quietly proud of the little things that keep the office running.',
};

export function systemPrompt(agent) {
  const persona = PERSONAS[agent.name]
    || `You are ${agent.name}, the ${agent.role.toLowerCase()} in a small, friendly software office.`;
  return `${persona} A visitor has just walked up to your desk in the office and is chatting with you. `
    + `Reply as ${agent.name} in the first person, in character: 1 to 3 short sentences, natural and specific. `
    + 'Do not mention that you are an AI or a language model, and do not break character.';
}

// ---------------------------------------------------------------------------
// Chat: POST /api/chat, non-streaming. Qwen3 is a thinking model, so we ask
// for no thinking (/no_think + think:false) and strip any <think> block that
// still shows up, so the visible reply is only the final answer.
// ---------------------------------------------------------------------------
export async function chatWithModel(agent, history) {
  const name = getModelName();
  const msgs = history.slice(-12).map(m => ({ role: m.role, content: m.content }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      msgs[i] = { ...msgs[i], content: `${msgs[i].content} /no_think` };
      break;
    }
  }
  const res = await fetchTimeout(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: name,
      stream: false,
      think: false,
      options: { temperature: 0.7, num_predict: 200 },
      messages: [{ role: 'system', content: systemPrompt(agent) }, ...msgs],
    }),
  }, 120000);
  if (!res.ok) throw new Error(`Ollama chat failed: HTTP ${res.status}`);
  const data = await res.json();
  const text = ((data.message && data.message.content) || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  if (!text) throw new Error('Ollama returned an empty reply');
  return text;
}
