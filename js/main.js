// 둥근모꼴을 다 읽은 뒤에 시작한다 (캔버스 글자가 대체 글꼴로 한 번 그려진 채 남지 않게)
PixelFont.patchPhaserText();
PixelFont.ready().then(() => {
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1b1b1b',
  pixelArt: true,    // 도트가 뭉개지지 않게 (Nearest Neighbor)
  roundPixels: true,
  // 창(100vw × 100dvh) 안에서 16:9 를 유지하며 가능한 한 크게, 가운데. 남는 부분은 검정 (style.css 의 body)
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: TUNING.gravity },
      fps: 120, // 고정 스텝을 촘촘하게 해서 입력 반응과 충돌을 정확하게
      debug: false,
    },
  },
  input: {
    activePointers: 4,
  },
  scene: [BootScene, GameScene],
});
// 전체 화면이 켜지고 꺼질 때 · 화면을 돌렸을 때 크기를 다시 잰다
for (const ev of ['fullscreenchange', 'webkitfullscreenchange', 'orientationchange']) {
  document.addEventListener(ev, () => setTimeout(() => window.game.scale.refresh(), 60));
}
PixelFont.watchArrows();
});
