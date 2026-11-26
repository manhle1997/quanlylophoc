const lines = {
  fishing: {
    baitSlip: ['Mồi thơm đấy, nhưng mình bơi thêm vòng nữa!', 'Suýt cắn câu rồi! Cho mình ngắm hồ chút nhé.'],
    lineShake: ['Ơ, ai đang kéo dây thế? Mình chưa sẵn sàng!', 'Phao rung rồi kìa! Mình lách qua một chút.'],
    quickDodge: ['Vèo! Bắt được mình đâu có dễ!', 'Mình né nhẹ một cái thôi mà!'],
  },
  ufo: {
    signalLost: ['A lô vũ trụ? Tín hiệu của mình đi lạc rồi!', 'Đang kết nối… Cho mình tìm lại sóng nhé!'],
    beamDrift: ['Ơ kìa, tia sáng đi nhầm đường rồi!', 'Lệch một xíu thôi! Mình vẫn ở đây mà.'],
    softLanding: ['Hạ cánh êm quá! Mình quay lại chào cả lớp.', 'Chuyến bay ngắn nhất vũ trụ là đây!'],
  },
  claw: {
    weakGrip: ['Ôm chặt nhé… Á, mình trượt mất rồi!', 'Mình mềm quá nên tuột tay một chút!'],
    earlyRelease: ['Khoan thả chứ! Mình vừa mới lên mà!', 'Được đi một đoạn rồi lại về tổ ấm!'],
    railStall: ['Đường ray nghỉ một chút, mình cũng nghỉ theo!', 'Chờ xíu nhé, chiếc móc đang lấy đà!'],
  },
  marble: {
    rampSlowdown: ['Dốc cao quá! Mình lấy đà thêm một nhịp.', 'Từ từ nào, còn cả đường đua phía trước!'],
    wideTurn: ['Ôm cua hơi rộng! Mình ngắm cảnh một chút.', 'Cua này đẹp quá, mình lượn thêm vòng nhé!'],
    gateDelay: ['Cổng ơi, mở cho mình đi với!', 'Mình chờ đèn xanh rồi bứt tốc nhé!'],
  },
  treasure: {
    lockedChest: ['Cạch… Chìa khóa này chưa vừa rồi!', 'Bí mật còn ở trong này! Thử chìa khác nhé.'],
    keyRedirect: ['Ơ, chìa khóa lại bay sang bên kia kìa!', 'Chìa khóa tinh nghịch quá, đuổi theo thôi!'],
    fadingGlow: ['Ánh sáng chơi trốn tìm với mình rồi!', 'Suýt mở ra rồi! Còn một chút phép màu nữa.'],
  },
};

export function characterDialogue(scenario, elapsedMs, revealed = false) {
  if (revealed) return null;
  const index = scenario.hooks.findIndex(h => elapsedMs >= h.startMs && elapsedMs <= h.endMs);
  if (index < 0) return null;
  const hook = scenario.hooks[index], choices = lines[scenario.gameId]?.[hook.kind];
  if (!choices) return null;
  const variation = ((scenario.visualSeed >>> 0) + index) % choices.length;
  return { key: `${scenario.playId}:${index}`, studentId: hook.studentId, index, text: choices[variation] };
}
