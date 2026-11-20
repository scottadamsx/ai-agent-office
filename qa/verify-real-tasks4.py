import subprocess, sys, time, os, signal, json
from playwright.sync_api import sync_playwright

# In-browser end-to-end proof of the real task system.
# NOTE: this run selects qwen3:0.6b through the app's own model setting,
# because this shared VM's ~6 GB sandbox cap cannot keep the 5.6 GB
# qwen3:8b runner alive alongside a WebGL browser (it is OOM-killed).
# The qwen3:8b task payloads were verified separately over the API.
ROOT = os.path.expanduser("~/workspace/ai-agent-office")
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell")
PORT = 8945
QA = os.path.join(ROOT, "qa")

PARAGRAPH = (
    "The community garden on Mercer Street opened in 2019 with twelve raised beds and a small tool shed. "
    "By 2023 it had grown to forty beds, a rainwater collection system, and a waiting list of sixty families. "
    "Volunteers run a Saturday market stall that funds seeds and repairs, and the garden donates about a third "
    "of its produce to the neighbourhood food bank. In 2025 the city renewed its lease for ten more years after "
    "a petition gathered 2,300 signatures."
)

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", ROOT],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EXE, args=[
            "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox",
            "--disable-dev-shm-usage", "--no-zygote", "--single-process",
            "--disable-extensions", "--mute-audio"])
        page = browser.new_page(viewport={"width": 1280, "height": 860})
        page.set_default_timeout(60000)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_timeout(2500)

        # select the small pulled model through the app's own persisted
        # model setting (the same localStorage key the Set button writes)
        page.evaluate("() => localStorage.setItem('ai-office-model', 'qwen3:0.6b')")
        page.reload()
        page.wait_for_timeout(2500)
        state = None
        for _ in range(30):
            state = page.evaluate("() => window.__app.model.state() + '|' + window.__app.model.name()")
            if state.startswith("ready"):
                break
            page.wait_for_timeout(1000)
        print("MODEL STATE:", state)

        page.fill("#task-title", "Summarize the community garden paragraph")
        page.fill("#task-instructions",
                  "Summarize the following paragraph in exactly two sentences.\n\n" + PARAGRAPH)
        page.select_option("#task-assignee", "Leo")
        page.click("#task-create")
        page.wait_for_timeout(400)
        page.fill("#task-title", "Write a Python palindrome checker")
        page.fill("#task-instructions",
                  "Write a Python function is_palindrome(s) that returns True if the string reads the "
                  "same forwards and backwards, ignoring case and spaces. Include two example calls.")
        page.select_option("#task-assignee", "Max")
        page.click("#task-create")
        page.wait_for_timeout(400)
        print("TASKS CREATED")

        deadline = time.time() + 900
        final = None
        while time.time() < deadline:
            final = page.evaluate("""() => window.__app.tasks.list().map(t => ({
                title: t.title, agent: t.agent, status: t.status, model: t.model,
                summary: t.summary, error: t.error,
                output: (t.output || '')}))""")
            if len(final) >= 2 and all(t["status"] in ("done", "failed") for t in final):
                break
            page.wait_for_timeout(4000)
        for t in final:
            print("TASK:", t["title"], "| agent:", t["agent"], "| status:", t["status"], "| model:", t["model"])
            print("  summary:", t["summary"])
            print("  error:", t["error"])
            print("  output:", t["output"][:500].replace("\n", "\\n"))

        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(QA, "real-tasks-board.png"))

        log = page.evaluate("""() => [...document.querySelectorAll('#event-log li')].map(li => li.textContent)""")
        print("EVENT LOG:", json.dumps(log, indent=1))
        el = page.query_selector("#right-panel")
        if el:
            el.screenshot(path=os.path.join(QA, "real-tasks-eventlog.png"))

        fake_phrases = ["Playing pool", "Drinking a coffee", "completed a task.",
                        "Typing at their desk", "In a meeting.", "settling in"]
        joined = " | ".join(log)
        for fp in fake_phrases:
            assert fp not in joined, f"FAKE LOG PHRASE FOUND: {fp}"
        print("FAKE PHRASE CHECK: clean")

        items = page.query_selector_all(".task-item")
        for it in items:
            if "garden" in it.inner_text().lower():
                it.click()
                break
        page.wait_for_timeout(700)
        modal_text = page.inner_text("#task-modal")
        print("MODAL (Leo):", modal_text[:900])
        page.screenshot(path=os.path.join(QA, "real-tasks-output.png"))
        browser.close()
finally:
    server.send_signal(signal.SIGTERM)
print("CONSOLE ERRORS:", len(errors), errors[:5])
print("done")
