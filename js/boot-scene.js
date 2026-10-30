// story.json 과 (있다면) 초상화 이미지를 먼저 읽은 뒤 게임을 시작한다.
class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.json('story', 'story.json');
  }

  create() {
    const story = this.cache.json.get('story');
    if (!story) {
      console.warn('story.json 을 불러오지 못했습니다. 대화 없이 시작합니다. (file:// 대신 로컬 서버나 GitHub Pages로 실행하세요)');
      this.scene.start('game');
      return;
    }
    // 그림 파일이 지정된 캐릭터는 이미지를 쓰고, 나머지는 도형으로 그린다
    let queued = 0;
    for (const [id, ch] of Object.entries(story.characters || {})) {
      if (ch.image) {
        this.load.image('portrait-' + id, ch.image);
        queued++;
      }
    }
    const start = () => {
      Portraits.generate(this, story.characters);
      this.scene.start('game');
    };
    if (queued === 0) {
      start();
    } else {
      this.load.once('complete', start);
      this.load.start();
    }
  }
}
