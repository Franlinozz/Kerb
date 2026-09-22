/** BUILD_PERIOD.md, parsed for /proof and /changelog. */

/** BUILD_PERIOD.md is a table of date, task, what; rendered grouped by day. */
export function buildRows(md: string | null): { date: string; task: string; what: string }[] {
  if (!md) return [];
  return md.split("\n").filter((l) => /^\|\s*\d{1,2} \w{3}/.test(l)).map((l) => {
    const [date = "", task = "", what = ""] = l.split("|").slice(1, -1).map((c) => c.trim());
    return { date, task, what };
  });
}

/** Inline markdown in a BUILD_PERIOD cell: code spans and bold, nothing else. */
export function Inline({ text }: { text: string }): React.ReactElement {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{parts.map((p, i) => p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)}</>;
}

