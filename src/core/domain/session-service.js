import { uid } from './schema.js';
export function commitResult(doc, scenario) {
  if (doc.history.some(h => h.playId === scenario.playId)) return false;
  const c = doc.classes.find(c => c.id === scenario.classId);
  if (!c?.students.some(s => s.id === scenario.winnerId)) throw new Error('Lớp hoặc học sinh của lượt chơi không còn tồn tại.');
  if (!scenario.eligibleIds.includes(scenario.winnerId)) throw new Error('Winner không thuộc pool.');
  if (scenario.mode === 'unique') {
    let round = doc.rounds.find(r => r.classId === scenario.classId);
    if (!round) { round = { classId: scenario.classId, roundId: scenario.roundId, calledStudentIds: [] }; doc.rounds.push(round); }
    if (round.roundId !== scenario.roundId) throw new Error('Vòng đã thay đổi trong lúc chơi.');
    if (!round.calledStudentIds.includes(scenario.winnerId)) round.calledStudentIds.push(scenario.winnerId);
  }
  doc.history.push({ id: uid(), playId: scenario.playId, classId: scenario.classId, roundId: scenario.roundId, studentId: scenario.winnerId, gameId: scenario.gameId, mode: scenario.mode, revealedAt: new Date().toISOString() });
  return true;
}
