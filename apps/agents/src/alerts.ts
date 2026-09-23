/**
 * Last Call alerts on Telegram (V3-08 step 2). Runs only when TELEGRAM_BOT_TOKEN is set.
 * Commands: /watch 0xaddress, /stop, /status. Every 30 s it reads the public positions feed and
 * tells each watcher when their position enters Last Call, five minutes before the cure deadline,
 * when it is cured, and when it is repaid. No model, no custody; the token is never logged.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";

interface Pos { user: string; symbol: string | null; mode: string; debt: string; cure: { eligible: boolean; deadline: string | null; requiredRepay: string }; lastCure: { tx: string | null } | null }
type Subs = Record<string, string[]>; // chatId -> addresses (lowercase)
type Seen = Record<string, { eligible: boolean; warned: boolean; lastCureTx: string | null; open: boolean }>;

const FILE = resolve(repoRoot(), "data/agents/alerts.json");
const MAX_WATCH = 5;
const load = (): { subs: Subs; seen: Seen } => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { subs: {}, seen: {} });
const save = (s: { subs: Subs; seen: Seen }): void => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(s)); };
const short = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;
const hm = (iso: string | null): string => (iso ? `${iso.slice(11, 16)} UTC` : "the deadline");

export function startAlerts(token: string, api = process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720", log: (s: string) => void = console.log): void {
  const tg = async (method: string, body: Record<string, unknown>): Promise<unknown> => {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(35_000) });
    return r.json();
  };
  const say = (chat: string, text: string): Promise<unknown> => tg("sendMessage", { chat_id: chat, text, disable_web_page_preview: true }).catch(() => null);
  const state = load();
  let offset = 0;

  async function updates(): Promise<void> {
    for (;;) {
      try {
        const r = (await tg("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] })) as { result?: { update_id: number; message?: { chat: { id: number }; text?: string } }[] };
        for (const u of r.result ?? []) {
          offset = u.update_id + 1;
          const chat = String(u.message?.chat.id ?? ""); const text = (u.message?.text ?? "").trim();
          if (!chat || !text) continue;
          const [cmd, arg] = text.split(/\s+/);
          if (cmd === "/watch") {
            if (!arg || !/^0x[0-9a-fA-F]{40}$/.test(arg)) { await say(chat, "Send /watch followed by a wallet address, for example /watch 0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4"); continue; }
            const list = (state.subs[chat] ??= []);
            if (list.length >= MAX_WATCH && !list.includes(arg.toLowerCase())) { await say(chat, `You can watch at most ${MAX_WATCH} addresses. Send /stop to clear them.`); continue; }
            if (!list.includes(arg.toLowerCase())) list.push(arg.toLowerCase());
            save(state);
            await say(chat, `Watching ${short(arg)} on Kerb Credit (X Layer testnet). You will hear when a Session Max position enters Last Call, five minutes before its cure deadline, and when it is cured or repaid.`);
          } else if (cmd === "/stop") { delete state.subs[chat]; save(state); await say(chat, "Stopped. No more alerts to this chat."); }
          else if (cmd === "/status") { const l = state.subs[chat] ?? []; await say(chat, l.length ? `Watching: ${l.map(short).join(", ")}` : "Not watching any address. Send /watch 0xaddress."); }
          else await say(chat, "Kerb Last Call alerts.\n/watch 0xaddress: alerts for that address\n/status: what you watch\n/stop: stop all alerts\nwww.usekerb.xyz/credit");
        }
      } catch { await new Promise((x) => setTimeout(x, 5000)); }
    }
  }

  async function tick(): Promise<void> {
    const watched = new Set(Object.values(state.subs).flat());
    if (!watched.size) return;
    let pos: Pos[] = [];
    try { pos = ((await (await fetch(`${api}/v1/credit/1952/positions?state=all`, { signal: AbortSignal.timeout(20_000) })).json()) as { positions: Pos[] }).positions; } catch { return; }
    const now = Date.now();
    const current = new Map(pos.filter((p) => watched.has(p.user.toLowerCase())).map((p) => [`${p.user.toLowerCase()}|${p.symbol}`, p]));
    const notify = async (addr: string, text: string): Promise<void> => { for (const [chat, list] of Object.entries(state.subs)) if (list.includes(addr)) await say(chat, text); };
    for (const [key, p] of current) {
      const addr = key.split("|")[0]!;
      const s = (state.seen[key] ??= { eligible: false, warned: false, lastCureTx: p.lastCure?.tx ?? null, open: true });
      const due = `${(Number(p.cure.requiredRepay) / 1e6).toFixed(2)} mUSDG`;
      if (p.cure.eligible && !s.eligible) await notify(addr, `Last Call is open for ${short(addr)} on ${p.symbol}. Cure back to Carry by ${hm(p.cure.deadline)}: about ${due}. After that anyone may cure it for a bonus. www.usekerb.xyz/credit`);
      if (p.cure.eligible && !s.warned && p.cure.deadline && Date.parse(p.cure.deadline) - now < 5 * 60_000) { await notify(addr, `Five minutes of Last Call left for ${short(addr)} on ${p.symbol} (${hm(p.cure.deadline)}). About ${due} to cure.`); s.warned = true; }
      if ((p.lastCure?.tx ?? null) !== s.lastCureTx && p.lastCure?.tx) await notify(addr, `${short(addr)} on ${p.symbol} was cured back to Carry. https://www.oklink.com/x-layer-testnet/tx/${p.lastCure.tx}`);
      if (!p.cure.eligible) s.warned = false;
      s.eligible = p.cure.eligible; s.lastCureTx = p.lastCure?.tx ?? null; s.open = true;
    }
    for (const [key, s] of Object.entries(state.seen)) {
      const addr = key.split("|")[0]!;
      if (s.open && !current.has(key) && watched.has(addr)) { await notify(addr, `${short(addr)} on ${key.split("|")[1]} is repaid: no debt left.`); s.open = false; }
    }
    save(state);
  }

  void updates();
  setInterval(() => void tick().catch(() => null), 30_000);
  log(`${new Date().toISOString()} Telegram Last Call alerts on`);
}
