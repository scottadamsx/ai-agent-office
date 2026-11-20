import subprocess, sys, time, os, signal, json
from playwright.sync_api import sync_playwright

# Offline honesty proof: Ollama is stopped before this runs. A task created
# in the UI must fail visibly, with the real reason, in the board and the log.
ROOT = os.path.expanduser("~/workspace/ai-agent-office")
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell")
PORT = 8946
QA = os.path.join(ROOT, "qa")

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", ROOT],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EXE, args=[
            "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox",
            "--disable-dev-shm-usage", "--no-zygote", "--single-process",
            "--disable-extensions", "--mute-audio"])
        page = browser.new_page(viewport={"width": 1280, "height": 860})
        page.set_default_timeout(60000)
        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_timeout(3000)
        print("MODEL STATE:", page.evaluate("() => window.__app.model.state()"))
        print("MODEL STATUS TEXT:", page.inner_text("#model-status"))
        print("OFFLINE BANNER:", page.inner_text("#task-offline"))

        page.fill("#task-title", "Offline test: draft a welcome note")
        page.fill("#task-instructions", "Write a two-line welcome note for a new team member.")
        page.select_option("#task-assignee", "Sam")
        page.click("#task-create")

        final = None
        for _ in range(40):
            final = page.evaluate("""() => window.__app.tasks.list().map(t => ({
                title: t.title, agent: t.agent, status: t.status, error: t.error }))""")
            if final and final[0]["status"] in ("done", "failed"):
                break
            page.wait_for_timeout(1500)
        print("TASK:", json.dumps(final))
        log = page.evaluate("""() => [...document.querySelectorAll('#event-log li')].map(li => li.textContent)""")
        print("EVENT LOG:", json.dumps(log))
        assert final and final[0]["status"] == "failed", "task should have failed while offline"
        assert "not reachable" in final[0]["error"], "failure reason should name Ollama unreachable"
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(QA, "real-tasks-offline.png"))
        browser.close()
finally:
    server.send_signal(signal.SIGTERM)
print("done")
