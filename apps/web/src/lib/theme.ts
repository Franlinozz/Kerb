/**
 * Night, Day and Market time (V2-DESIGN-SYSTEM.md section 2). `data-theme` on <html> is always
 * night or day; "market" resolves to day while the New York regular session is open.
 */
export type ThemeMode = "night" | "day" | "market";
export const THEME_KEY = "kerb-theme";

/** New York regular session by the weekday rule, in exchange local time so DST is right. */
export function nyRegularOpen(at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday");
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return !["Sat", "Sun"].includes(day) && minutes >= 570 && minutes < 960;
}

export function readMode(): ThemeMode {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === "day" || t === "market" || t === "night") return t;
    if (t === "light") return "day";
  } catch { /* storage refused: default */ }
  return "night";
}

export function applyMode(mode: ThemeMode, marketOpen?: boolean): void {
  const open = marketOpen ?? nyRegularOpen();
  const theme = mode === "market" ? (open ? "day" : "night") : mode;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-theme-mode", mode);
}

/**
 * Inline before first paint so the wrong theme never flashes. Same rule as nyRegularOpen, kept
 * dependency-free because it runs before any bundle loads. Holidays are corrected by the theme
 * menu from /v1/clock once the page is live.
 */
export const THEME_BOOTSTRAP = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light')t='day';if(t==='dark')t='night';if(t!=='day'&&t!=='market')t='night';var th=t;if(t==='market'){var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());var g=function(k){for(var i=0;i<p.length;i++)if(p[i].type===k)return p[i].value;return''};var m=Number(g('hour'))*60+Number(g('minute'));var w=g('weekday');th=(w!=='Sat'&&w!=='Sun'&&m>=570&&m<960)?'day':'night';}d.setAttribute('data-theme',th);d.setAttribute('data-theme-mode',t);}catch(e){d.setAttribute('data-theme','night');}})();`;
