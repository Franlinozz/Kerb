/** BUILD_PERIOD.md, parsed for /proof and /changelog. */

/** BUILD_PERIOD.md is a table of date, task, what; rendered grouped by day. */
export function buildRows(md: string | null): { date: string; task: string; what: string }[] {
  if (!md) return [];
  return md.split("\n").filter((l) => /^\|\s*\d{1,2} \w{3}/.test(l)).map((l) => {
    const [date = "", task = "", what = ""] = l.split("|").slice(1, -1).map((c) => c.trim());
    return { date, task, what };
  });
}

/** Inline markdown in a BUILD_PERIOD cell: code spans, bold and links, nothing else. */
export function Inline({ text }: { text: string }): React.ReactElement {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:[^)\s]+\))/g).filter(Boolean);
  return <>{parts.map((p, i) => {
    if (p.startsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith("**")) return <b key={i}><Inline text={p.slice(2, -2)} /></b>;
    const link = /^\[([^\]]+)\]\((https?:[^)\s]+)\)$/.exec(p);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <span key={i}>{p}</span>;
  })}</>;
}
