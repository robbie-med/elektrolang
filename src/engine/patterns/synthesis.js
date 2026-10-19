// Ranking and synthesis.
//
// Per finding group: each candidate cause gets base weight × demographic prior;
// the group then hands out one unit of "vote" (× the group's weight) divided in
// proportion to those scores.
//
// Synthesis: a cause's score is the sum of the votes it receives across ALL
// groups. A cause that sits on several findings' lists therefore beats one that
// is merely the single most common explanation of one finding — which is what
// "ties everything together" means. Shares are relative teaching weights, not
// calibrated probabilities.

import { prior } from "./causes.js";

// Generic explanations get half-credit in the synthesis so they only win when
// nothing more specific accounts for the findings.
const GENERIC = { normalvar: 0.5, nonspecific: 0.5 };

export function rankGroup(g, demo) {
  const scored = g.causes.map(([id, w]) => ({ id, w, score: w * prior(id, demo) }));
  const sum = scored.reduce((a, x) => a + x.score, 0) || 1;
  return scored
    .map(x => ({ ...x, share: x.score / sum }))
    .sort((a, b) => b.score - a.score);
}

export function synthesize(groups, demo) {
  const active = groups.filter(g => g.weight > 0.05);
  const votes = new Map(); // cause → { score, from: [{gkey, v}] }
  for (const g of active) {
    for (const r of g.ranked) {
      const v = g.weight * r.share * (GENERIC[r.id] ?? 1);
      if (!votes.has(r.id)) votes.set(r.id, { id: r.id, score: 0, from: [] });
      const e = votes.get(r.id);
      e.score += v;
      e.from.push({ gkey: g.key, v, share: r.share });
    }
  }
  const total = [...votes.values()].reduce((a, x) => a + x.score, 0) || 1;
  const ranked = [...votes.values()].sort((a, b) => b.score - a.score);
  const max = ranked[0]?.score || 1;
  const weighty = active.filter(g => g.weight >= 0.5);
  const rankOf = new Map(active.map(g => [g.key, new Map(g.ranked.map((r, i) => [r.id, i]))]));

  return {
    candidates: ranked.map(e => {
      // "Supports" = the cause is among that finding's top-5 explanations.
      const inTop5 = (f) => (rankOf.get(f.gkey)?.get(e.id) ?? 99) < 5;
      const supports = e.from.filter(inTop5).sort((a, b) => b.v - a.v).map(f => f.gkey);
      const unexplained = weighty.filter(g => !supports.includes(g.key)).map(g => g.key);
      return { id: e.id, score: e.score, share: e.score / total, rel: e.score / max, supports, unexplained };
    }),
    activeCount: active.length,
  };
}

// Running differential after each reading step (groups with step ≤ n).
export function runningDifferential(groups, demo, upto) {
  const sub = groups.filter(g => g.step <= upto);
  if (!sub.length) return [];
  return synthesize(sub, demo).candidates.slice(0, 3).map(c => c.id);
}
