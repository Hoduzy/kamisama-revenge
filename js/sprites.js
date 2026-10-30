// assets/sprites/manifest.json 의 스프라이트를 읽어 텍스처·애니메이션을 만들고,
// 캐릭터와 별도로 겹쳐 재생하는 이펙트를 띄우는 도우미.
// 이미지가 없으면(로딩 실패) 각 클래스는 예전 도형으로 그린다.
const SPRITE_DIR = 'assets/sprites/';

// 바닥/발판에 쓸 타일 (assets/sprites/tiles/)
const GROUND_TILES = { top: 'tile_r3_c00', platform: 'tile_r2_c00' };

const Sprites = {
  manifest: null,

  // BootScene.create 에서 호출: manifest 의 시트·배경·타일을 로딩 대기열에 넣는다
  queue(scene, manifest) {
    this.manifest = manifest;
    for (const [name, s] of Object.entries(manifest.sheets || {})) {
      if (s.tiles) continue;
      if (s.frames) {
        scene.load.spritesheet(name, SPRITE_DIR + s.file, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
      } else {
        scene.load.image(name, SPRITE_DIR + (s.strip ? s.strip.file : s.file));
      }
    }
    for (const t of Object.values(GROUND_TILES)) scene.load.image(t, `${SPRITE_DIR}tiles/${t}.png`);
  },

  has(scene, key) {
    return scene.textures.exists(key);
  },

  sheet(name) {
    return this.manifest && this.manifest.sheets[name];
  },

  // 그림 속 캐릭터 키 (머리 위 표시 위치 계산용)
  height(name, fallback) {
    const s = this.sheet(name);
    return s && s.heights ? s.heights[0] : fallback;
  },

  createAnims(scene) {
    const A = scene.anims;
    const add = (key, sheet, frames, frameRate, repeat = 0) => {
      if (!scene.textures.exists(sheet) || A.exists(key)) return;
      A.create({ key, frames: A.generateFrameNumbers(sheet, { frames }), frameRate, repeat });
    };
    const all6 = [0, 1, 2, 3, 4, 5];
    add('player_idle', 'player_idle', all6, 8, -1);
    add('player_run', 'player_run', all6, 12, -1);
    add('player_dash', 'player_dash', all6, 30);
    add('player_iaido_ready', 'player_iaido_ready', all6, 6 / TUNING.iaido.chargeTime); // 준비 1초 동안 재생 후 마지막 프레임 유지
    add('player_iaido_slash', 'player_iaido_slash', all6, 20);
    add('player_attack', 'player_iaido_slash', [1, 2, 3, 4], 36); // 기본 공격(J): 베기 시트 앞부분을 빠르게
    add('player_parry', 'player_parry', all6, 20);
    add('player_death', 'player_death', all6, 10);
    add('fx_slash', 'fx_slash', [0, 1, 2, 3], 24);
    add('fx_parry_flash', 'fx_parry_flash', [0, 1, 2, 3], 20);
    add('fx_sakura_burst', 'fx_sakura_burst', [0, 1, 2, 3], 16);
  },

  // 캐릭터 위에 겹쳐 한 번 재생하고 사라지는 이펙트
  fx(scene, key, x, y, opts = {}) {
    if (!scene.textures.exists(key) || !scene.anims.exists(key)) return null;
    const s = scene.add.sprite(x, y, key, 0).setDepth(opts.depth || 14).setScale(opts.scale || 1);
    if (opts.flipX) s.setFlipX(true);
    if (opts.tint) s.setTint(opts.tint);
    if (opts.angle) s.setAngle(opts.angle);
    s.play(key);
    s.once('animationcomplete', () => s.destroy());
    return s;
  },

  // effects 의 꽃잎 4종 중 하나
  petal(scene, x, y) {
    if (!scene.textures.exists('fx_petals')) {
      return scene.add.image(x, y, 'petal').setTint(Phaser.Utils.Array.GetRandom(SAKURA_COLORS));
    }
    return scene.add.image(x, y, 'fx_petals', Phaser.Math.Between(0, 3));
  },
};
