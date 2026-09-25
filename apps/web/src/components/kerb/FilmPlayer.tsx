"use client";
/**
 * The demo film with its chapters. The chapter list seeks the video and follows playback, so a judge
 * can jump straight to Last Call or Proof. Captions ship as WebVTT beside the file.
 */
import { useEffect, useRef, useState } from "react";

export interface FilmChapter { t: number; label: string; note: string }

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function FilmPlayer({ src, poster, captions, chapters }: { src: string; poster: string; captions: string; chapters: FilmChapter[] }): React.ReactElement {
  const ref = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const on = (): void => setNow(v.currentTime);
    v.addEventListener("timeupdate", on);
    return () => v.removeEventListener("timeupdate", on);
  }, []);
  const current = chapters.reduce((acc, c, i) => (now + 0.25 >= c.t ? i : acc), 0);
  const seek = (t: number): void => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => undefined);
  };
  return (
    <div className="film">
      <div className="film-frame">
        <video ref={ref} controls preload="metadata" playsInline poster={poster} aria-label="Kerb demo film">
          <source src={src} type="video/mp4" />
          <track kind="captions" src={captions} srcLang="en" label="English" />
          Your browser cannot play this video. <a href={src}>Download it</a>.
        </video>
      </div>
      <ol className="film-chapters" aria-label="Chapters">
        {chapters.map((c, i) => (
          <li key={c.t}>
            <button type="button" onClick={() => seek(c.t)} aria-current={i === current ? "true" : undefined}>
              <span className="film-t">{clock(c.t)}</span>
              <span className="film-l">{c.label}</span>
              <span className="film-n">{c.note}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
