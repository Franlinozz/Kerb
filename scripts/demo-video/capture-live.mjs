#!/usr/bin/env node
// capture-live.mjs <path> <seconds> <out.mkv> [settleSeconds]
// Records a live public Kerb route under Xvfb at the operator's layout scale:
// the operator recorded at Windows 125% scaling (a ~1518 css px viewport); at device scale 1.25 x 1.1268 = 1.4085
// the window is 2140x1080 device px and the grabbed centre 1920x1080 matches the cropped operator framing,
// which is the same framing as the cropped operator recordings. No cursor, no browser chrome, tour marked seen.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("/root/marque/package.json");
const { chromium } = require("playwright-core");

const [path = "/", secs = "10", out = "capture.mkv", settle = "10"] = process.argv.slice(2);
const DISP = ":78", SW = 2140, SH = 1080, DSF = 1.4085;
const xvfb = spawn("Xvfb", [DISP, "-screen", "0", `${SW}x${SH}x24`, "-nolisten", "tcp"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1000));
const browser = await chromium.launch({
  executablePath: "/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  headless: false,
  env: { ...process.env, DISPLAY: DISP },
  args: ["--no-sandbox", "--kiosk", "--window-position=0,0", "--window-size=1519,767", `--force-device-scale-factor=${DSF}`,
    "--hide-scrollbars", "--disable-infobars", "--disable-notifications", "--no-first-run"],
});
const ctx = await browser.newContext({ viewport: null, colorScheme: "dark" });
await ctx.addInitScript(() => { try { localStorage.setItem("kerb-tour-seen", "1"); } catch {} });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const { windowId } = await cdp.send("Browser.getWindowForTarget");
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "fullscreen" } });
await page.goto("https://www.usekerb.xyz" + path, { waitUntil: "networkidle", timeout: 90000 });
await page.mouse.move(SW / DSF - 2, SH / DSF - 2);
await new Promise((r) => setTimeout(r, Number(settle) * 1000));
const vw = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
console.error("viewport css", vw);
const ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "x11grab", "-draw_mouse", "0", "-framerate", "30",
  "-video_size", "1920x1080", "-i", `${DISP}+110,0`, "-t", secs, "-c:v", "libx264", "-preset", "veryfast", "-crf", "8", "-pix_fmt", "yuv444p", out], { stdio: "inherit" });
await new Promise((r) => ff.on("exit", r));
await browser.close();
xvfb.kill();
