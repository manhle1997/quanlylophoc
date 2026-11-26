export function randomInt(maxExclusive, cryptoImpl = globalThis.crypto) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 2 ** 32) throw new RangeError('Invalid random bound');
  const range = 2 ** 32, limit = range - range % maxExclusive, buffer = new Uint32Array(1);
  do { cryptoImpl.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}
export const randomSource = { int: randomInt };
export function sampleDistinct(items, count, rng = randomSource) {
  if (!Number.isInteger(count) || count < 0 || count > items.length) throw new RangeError('Invalid sample size');
  const copy = [...items];
  for (let i = 0; i < count; i++) { const j = i + rng.int(copy.length - i); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, count);
}
