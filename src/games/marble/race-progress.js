export function raceProgress(scenario, studentId, index, elapsedMs) {
  const normalized = Math.min(1, Math.max(0, elapsedMs / scenario.revealAtMs));
  const final = Math.min(1, Math.max(0, (elapsedMs / scenario.durationMs - .62) / .23));
  const ease = .5 - Math.cos(final * Math.PI) / 2;
  const wave = Math.sin(normalized * 8 + index * .8) * .022;
  let position = normalized * .77 + (index % 9) * .006 + wave;
  const hook = scenario.hooks.find(h => h.studentId === studentId && elapsedMs >= h.startMs && elapsedMs <= h.endMs);
  if (hook) position += Math.sin((elapsedMs - hook.startMs) / (hook.endMs - hook.startMs) * Math.PI) * .17;
  if (studentId === scenario.winnerId) return Math.min(1, Math.max(0, normalized * .77 + ease * .23));
  return Math.min(.94, Math.max(0, position));
}
