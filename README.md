# AI Agent Virtual Office

A 3D virtual office populated by five AI agents, built with [Three.js](https://threejs.org/).
Everything in the scene — rooms, furniture, signs, posters, people — is generated in code.
No external assets; Three.js itself is vendored in `vendor/` so the app also runs fully offline.

## Run it

Any static file server works, from this folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL in a browser. There is no build step.

## Local model (Ollama)

The five agents can chat for real, powered by a local model served by
[Ollama](https://ollama.com) on your own machine. No cloud, no API key: the
browser talks straight to Ollama at `http://localhost:11434`.

The default model is **Qwen3 8B** (`qwen3:8b`), the most pulled current Qwen
on Ollama. To set it up on a Mac:

```sh
# 1. Install Ollama (or download the app from ollama.com)
brew install ollama        # or: curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull the model (about 5.2 GB)
ollama pull qwen3:8b

# 3. Make sure the server is running
ollama serve               # not needed if the Ollama app is open
```

The **LOCAL MODEL** section in the left panel shows the live status
(Connected / Not pulled / Offline, rechecked every 15 seconds). You can type
any other Ollama tag into the settings box there (for example `qwen3:4b` or
`llama3.1:8b`) and hit **Set**; the choice is saved in your browser.

If Ollama is off or the model is not pulled, nothing is simulated: chat
replies are unavailable and tasks fail with the reason recorded. The panels
say so plainly.

## Real tasks (the task board)

The **TASK BOARD** at the bottom of the screen is where the agents do real
work. Create a task with a title and instructions, assign it to an agent (or
leave it on **Auto** and Olivia routes it through the model), and the agent
executes it through Ollama with a role-specific system prompt: Olivia plans
and reviews, Leo researches and summarizes, Max writes code, Mia writes
copy, Sam organizes and drafts.

Every task and its real output (summary, code, draft, plan) is kept in a
persistent work record in your browser (localStorage), with timestamps, the
agent, the model name, and the status. Click any task on the board to open
its output.

The **EVENT LOG** records only real events: task created, task started,
task completed (with a one-line summary taken from the actual output), and
task failed (with the real reason). The agents' wandering around the office
is idle animation only; it never writes to the log and never counts as work.

### Using the deployed site with your local Ollama

The live site is https://ai-agent-office-omega.vercel.app/ . Browsers only
let a website talk to your local Ollama if Ollama allows that origin. The
default Ollama settings already allow `localhost`, so serving this folder
locally (see above) just works. For the deployed Vercel site, allow its
origin once on your Mac:

```sh
launchctl setenv OLLAMA_ORIGINS "https://ai-agent-office-omega.vercel.app"
# then quit and restart the Ollama app (or restart `ollama serve`)
```

`OLLAMA_ORIGINS "*"` also works and allows any website to reach your local
Ollama; the specific origin above is the safer choice.

## What you get

**Overview** (default tab) — an isometric 3D view of the whole office floor.
Drag to orbit, scroll to zoom. The left panel shows office stats counted
from the real work record (RUNNING TASKS, COMPLETED TASKS, TASK PROGRESS)
and each agent's current activity; the right panel is the event log of real
task events; the bottom panel is the task board.

**Walk In** — first-person mode. You start at reception, facing the
AGENT OFFICE sign. Walk up to any agent and press **E** to chat with them.

**Lounge** — jumps your first-person camera straight into the lounge.

## The office

Reception (AGENT OFFICE sign, receptionist desk), a manager office, an
open-plan cubicle floor, a meeting room with a growth chart, a printer/copy
room, a hallway with glass doors, a STOCKS poster, a kitchen with a coffee
machine, a lounge (red beanbag, red rug, sofa, accessible entrance), a
bathroom (one stall is out of order), and a game room with foosball, two
pool tables, arcade machines and a dartboard.

## The agents

- **Olivia** — Manager. Blonde, runs the office from the manager office by reception.
- **Leo** — Researcher.
- **Max** — Developer. Beard, glasses, headphones around his neck, a `</>` shirt, and code on every screen behind him.
- **Mia** — Designer.
- **Sam** — Assistant.

Agents wander between rooms on their own: they sit at their desks, grab
coffee, hold meetings, print documents, water the plants, and play foosball,
pool and arcade games. That wandering is idle animation only: it does not
count as tasks, does not advance any progress bar, and is never written to
the event log. Real work happens only through the task board.

## Controls

| Input | Action |
| --- | --- |
| Drag (Overview) | Orbit the camera |
| Mouse wheel (Overview) | Zoom |
| Click scene (Walk In) | Capture the mouse for look-around |
| WASD / arrow keys | Walk |
| Shift | Walk faster |
| E | Talk to the agent in front of you |
| Esc | Close chat / release the mouse |

## Files

- `index.html` — app shell, top bar tabs, panels, chat UI
- `styles.css` — all UI styling
- `js/main.js` — renderer, cameras, modes, walk-in controls, chat, stats, task board UI
- `js/model.js` — the Ollama layer: health checks, per-agent system prompts, chat, task completions
- `js/tasks.js` — the real task system: persistent work record, task execution through the model, the honest event feed
- `js/office.js` — the office: rooms, furniture, signs, waypoint graph
- `js/agents.js` — the agents: bodies, idle-animation behaviour, greetings
- `js/util.js` — geometry and canvas-texture helpers
- `vendor/three.module.js` — Three.js r160 (vendored)
