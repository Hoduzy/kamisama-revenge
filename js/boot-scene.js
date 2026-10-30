// 스토리 데이터(data/story), 스프라이트 manifest 와 그 안의 이미지들을 먼저 읽은 뒤 게임을 시작한다.
class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.json('story-characters', 'data/story/characters.json');
    this.load.json('story-audio', 'data/story/audio.json');
    for (const id of STORY_FILES) this.load.json('story-' + id, `data/story/${id}.json`);
    this.load.json('sprites', SPRITE_DIR + 'manifest.json');
  }

  create() {
    if (!UI.root) UI.init(this.game);
    const characters = this.cache.json.get('story-characters');
    const manifest = this.cache.json.get('sprites');
    if (!characters || !manifest) {
      console.warn('data/story 또는 sprites/manifest.json 을 불러오지 못했습니다. (file:// 대신 로컬 서버나 GitHub Pages로 실행하세요)');
    }
    StoryAudio.init(this.cache.json.get('story-audio'));
    DevMenu.init(this.game);
    if (manifest) Sprites.queue(this, manifest);

    const start = () => {
      Sprites.createAnims(this);
      this.scene.start('game');
    };
    if (this.load.list.size === 0) {
      start();
    } else {
      this.load.once('complete', start);
      this.load.start();
    }
  }
}
