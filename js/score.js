// Comparing what was sent with what was copied: a Levenshtein alignment over the
// characters (spaces ignored), so a missed or extra character doesn't throw off the rest.
// DOM-free.

export function align(sent, got) {
  const a = [...sent.toUpperCase().replace(/\s+/g, '')];
  const b = [...got.toUpperCase().replace(/\s+/g, '')];
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  // Walk back to recover the operations, in order.
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push(a[i - 1] === b[j - 1] ? { op: 'ok', sent: a[i - 1] } : { op: 'wrong', sent: a[i - 1], got: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'missed', sent: a[i - 1] });
      i--;
    } else {
      ops.push({ op: 'extra', got: b[j - 1] });
      j--;
    }
  }
  ops.reverse();
  const errors = d[n][m];
  return { ops, errors, accuracy: n ? Math.max(0, 1 - errors / n) : 1 };
}

// Per-character outcome counts from an alignment, for the stats.
export function tally(ops) {
  const out = {};
  for (const o of ops) {
    if (!o.sent) continue;
    out[o.sent] ??= { right: 0, wrong: 0 };
    if (o.op === 'ok') out[o.sent].right++;
    else out[o.sent].wrong++;
  }
  return out;
}
