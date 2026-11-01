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
  // 배율은 PixelFont.attachScale 이 정수배로 맞춘다 (FIT 은 1.37배 같은 배율이 나와 글자가 흐려짐)
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: PixelFont.fitZoom(),
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
PixelFont.attachScale(window.game);
PixelFont.watchArrows();
});
