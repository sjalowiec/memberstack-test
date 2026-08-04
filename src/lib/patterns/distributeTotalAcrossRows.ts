/** Spread whole stitches across row slots; remainder stitches go to the earliest rows. */
export function distributeTotalAcrossRows(total: number, rows: number): number[] {
  const r = Math.max(0, Math.floor(rows));
  if (r === 0) return [];
  const t = Math.max(0, Math.round(total));
  if (t === 0) return Array(r).fill(0);
  const base = Math.floor(t / r);
  const rem = t % r;
  const out: number[] = [];
  for (let i = 0; i < r; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}
