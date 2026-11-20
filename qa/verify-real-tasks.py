import subprocess, sys, time, os, signal, json
from playwright.sync_api import sync_playwright

ROOT = os.path.expanduser("~/workspace/ai-agent-office")
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell")
PORT = 8943
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
            "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"])
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_timeout(3000)

        # wait for the model to report ready
        state = None
        for _ in range(30):
            state = page.evaluate("() => window.__app.model.state()")
            if state == "ready":
                break
            page.wait_for_timeout(1000)
        print("MODEL STATE:", state)

        # --- create task 1 for Leo through the real UI form ---
        page.fill("#task-title", "Summarize the community garden paragraph")
        page.fill("#task-instructions",
                  "Summarize the following paragraph in exactly two sentences.\n\n" + PARAGRAPH)
        page.select_option("#task-assignee", "Leo")
        page.click("#task-create")
        page.wait_for_timeout(600)

        # --- create task 2 for Max ---
        page.fill("#task-title", "Write a Python palindrome checker")
        page.fill("#task-instructions",
                  "Write a Python function is_palindrome(s) that returns True if the string reads the "
                  "same forwards and backwards, ignoring case and spaces. Include two example calls.")
        page.select_option("#task-assignee", "Max")
        page.click("#task-create")
        page.wait_for_timeout(600)

        # --- wait for both tasks to finish (real model work on CPU: be patient) ---
        deadline = time.time() + 1500
        final = None
        while time.time() < deadline:
            final = page.evaluate("""() => window.__app.tasks.list().map(t => ({
                title: t.title, agent: t.agent, status: t.status, model: t.model,
                summary: t.summary, error: t.error,
                outputHead: (t.output || '').slice(0, 400)}))""")
            if len(final) >= 2 and all(t["status"] in ("done", "failed") for t in final):
                break
            page.wait_for_timeout(5000)
        print("TASKS:", json.dumps(final, indent=1))

        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(QA, "real-tasks-board.png"))

        # event log close-up
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

        # --- open Leo's output from the board ---
        items = page.query_selector_all(".task-item")
        # list is newest first: Max is first, Leo second
        for it in items:
            if "garden" in it.inner_text().lower():
                it.click()
                break
        page.wait_for_timeout(700)
        modal_text = page.inner_text("#task-modal")
        print("MODAL (Leo):", modal_text[:600])
        page.screenshot(path=os.path.join(QA, "real-tasks-output.png"))
        browser.close()
finally:
    server.send_signal(signal.SIGTERM)
print("CONSOLE ERRORS:", len(errors), errors[:5])
print("done")
