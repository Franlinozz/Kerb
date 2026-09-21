/** Placeholder in the final geometry: pass the size of the thing that will be there. */
export function Skeleton({ w = "100%", h = 16, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }): React.ReactElement {
  return <span className="skel" aria-hidden="true" style={{ display: "block", width: w, height: h, ...style }} />;
}

export function SkeletonPage({ rows = 6 }: { rows?: number }): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w={220} h={11} />
      <Skeleton w="min(560px, 90%)" h={44} style={{ marginTop: 16 }} />
      <Skeleton w="min(680px, 95%)" h={18} style={{ marginTop: 18 }} />
      <Skeleton h={88} style={{ marginTop: 40 }} />
      <div style={{ marginTop: 40 }}>
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={56} style={{ marginTop: 2 }} />)}
      </div>
    </div>
  );
}
