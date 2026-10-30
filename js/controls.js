// 키보드 + 터치 입력을 하나로 합친다.
// 각 액션은 { down, pressed } 를 가진다. pressed 는 이번 프레임에 새로 눌렸는지.
// 키 이벤트로 눌림을 래치하므로 한 프레임보다 짧은 탭도 놓치지 않는다.
class Controls {
  constructor(scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.bindings = {
      left: [K.A, K.LEFT],
      right: [K.D, K.RIGHT],
      jump: [K.SPACE, K.W, K.UP],
      attack: [K.J],
      dash: [K.K, K.SHIFT],
    };
    this.keys = {};
    this.keyHandlers = [];
    this.latched = {};
    this.state = {};

    for (const action of Object.keys(this.bindings)) {
      this.keys[action] = this.bindings[action].map((code) => {
        const key = scene.input.keyboard.addKey(code, true);
        const onDown = () => { this.latched[action] = true; };
        key.on('down', onDown);
        this.keyHandlers.push([key, onDown]);
        return key;
      });
      this.state[action] = { down: false, pressed: false };
    }

    // 창 포커스를 잃으면 키가 눌린 채로 남지 않게
    this.game = scene.game;
    this.onBlur = () => scene.input.keyboard.resetKeys();
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur);
  }

  destroy() {
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur);
    for (const [key, fn] of this.keyHandlers) key.off('down', fn);
  }

  update() {
    for (const action of Object.keys(this.bindings)) {
      const s = this.state[action];
      s.down = this.keys[action].some((k) => k.isDown) || TouchPad.isDown(action);
      const touchPressed = TouchPad.consume(action);
      s.pressed = !!this.latched[action] || touchPressed;
      this.latched[action] = false;
    }
  }

  get dirX() {
    return (this.state.right.down ? 1 : 0) - (this.state.left.down ? 1 : 0);
  }
}
