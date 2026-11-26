export const games = [
  { id: 'fishing', name: 'Câu cá may mắn', short: 'Câu cá', tag: 'MỘT CHÚT THƯ THẢ', description: 'Thả cần xuống hồ, đón một bất ngờ.', color: '#69d9c3', theme: 'teal', hooks: ['baitSlip', 'lineShake', 'quickDodge'] },
  { id: 'ufo', name: 'Phi thuyền bí ẩn', short: 'Phi thuyền', tag: 'TÍN HIỆU VŨ TRỤ', description: 'Ai sẽ được vị khách vũ trụ ghé thăm?', color: '#b3a3fa', theme: 'purple', hooks: ['signalLost', 'beamDrift', 'softLanding'] },
  { id: 'claw', name: 'Máy gắp thú', short: 'Gắp thú', tag: 'GẮP TRỌN NIỀM VUI', description: 'Một lần gắp, một người bạn đặc biệt.', color: '#f1adc6', theme: 'pink', hooks: ['weakGrip', 'earlyRelease', 'railStall'] },
  { id: 'marble', name: 'Đường đua bi', short: 'Đua bi', tag: 'BẤT NGỜ PHÚT CUỐI', description: 'Lăn qua đường đua đầy sắc màu.', color: '#c2a2f5', theme: 'violet', hooks: ['rampSlowdown', 'wideTurn', 'gateDelay'] },
  { id: 'treasure', name: 'Kho báu bí ẩn', short: 'Kho báu', tag: 'MỞ KHÓA ĐIỀU KỲ DIỆU', description: 'Chiếc rương nào đang chờ được mở?', color: '#edc17f', theme: 'gold', hooks: ['lockedChest', 'keyRedirect', 'fadingGlow'] },
];
export const getGame = id => games.find(g => g.id === id);
const loaders = {
  fishing: () => import('../../games/fishing/index.js'),
  ufo: () => import('../../games/ufo/index.js'),
  claw: () => import('../../games/claw/index.js'),
  marble: () => import('../../games/marble/index.js'),
  treasure: () => import('../../games/treasure/index.js'),
};
export function loadGameModule(id) { if (!loaders[id]) throw new Error('Game không hợp lệ.'); return loaders[id](); }
