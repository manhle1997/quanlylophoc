import { uid } from '../domain/schema.js';
import { getGame } from '../game/game-registry.js';
import { createSelection } from './random-engine.js';
import { randomSource } from './random-source.js';
const durations = { quick: 6000, normal: 12000, dramatic: 18000 };
export function createScenario({ document, classId, pool, gameId, rng = randomSource, visualSeed }) {
  const game = getGame(gameId), settings = document.settings;
  if (!game) throw new Error('Invalid game');
  const durationMs = durations[settings.durationPreset];
  if (!durationMs) throw new Error('Invalid duration');
  const selection = createSelection(pool, settings.hookMode, rng);
  const windows = [[0.25, 0.4], [0.47, 0.62]];
  const hooks = selection.nearMissIds.map((studentId, i) => Object.freeze({
    studentId, kind: game.hooks[rng.int(game.hooks.length)],
    startMs: windows[i][0] * durationMs, endMs: windows[i][1] * durationMs,
  }));
  return Object.freeze({ playId: uid(), classId, roundId: settings.mode === 'unique' ? document.rounds.find(r => r.classId === classId)?.roundId ?? uid() : null,
    gameId, mode: settings.mode, eligibleIds: Object.freeze([...pool]), winnerId: selection.winnerId, hooks: Object.freeze(hooks),
    durationMs, revealAtMs: durationMs * .85, visualSeed: visualSeed ?? rng.int(2 ** 32), quality: settings.quality,
  });
}
