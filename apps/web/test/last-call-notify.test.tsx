import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LastCallNotify } from "../src/components/credit/LastCallNotify";

describe("Last Call notify (V3-08)", () => {
  const at = Date.parse("2026-09-23T15:53:58Z");
  it("offers the reminder for an open Session Max position, and says it needs the tab", () => {
    const h = renderToStaticMarkup(<LastCallNotify active opensAt={at} closesAt={at + 600_000} what="Your position" />);
    expect(h).toContain("Notify me when Last Call opens");
    expect(h).toContain("Works while this tab stays open.");
  });
  it("shows nothing when no cure can be needed", () => {
    expect(renderToStaticMarkup(<LastCallNotify active={false} opensAt={at} closesAt={at + 600_000} what="x" />)).toBe("");
  });
});
