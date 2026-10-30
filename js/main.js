window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1b1b1b',
  scale: {
    mode: Phaser.Scale.FIT,
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
