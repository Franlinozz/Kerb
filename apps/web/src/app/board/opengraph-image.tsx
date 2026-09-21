import { ogCard, OG_ALT, OG_SIZE } from "@/lib/og";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image(): ReturnType<typeof ogCard> {
  return ogCard("The Board", "What each stock can safely support, right now.");
}
