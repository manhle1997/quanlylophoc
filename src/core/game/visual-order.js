// Presentation-only shuffle. The scenario already owns the selected IDs;
// never consume the selection RNG or change the roster/eligibleIds here.
export function visualOrder(students, visualSeed) {
  const ordered = [...students];
  let state = visualSeed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 2 ** 32;
  };
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}
