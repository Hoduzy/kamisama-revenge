// 대화창 초상화. 아직 그림 파일이 없으므로 data/story/characters.json 의 portrait 설정으로 도형을 그려 텍스처로 만든다.
// characters.json 에서 인물에 "image": "assets/xxx.png" 를 넣으면 그 그림을 대신 쓴다 (boot-scene.js 에서 로드).
const PORTRAIT_SIZE = 128;

const Portraits = (function () {
  const hex = (s, fallback) => (s ? Phaser.Display.Color.HexStringToColor(s).color : fallback);

  function body(g, p) {
    g.fillStyle(hex(p.clothes, 0x444444)).fillRect(20, 104, 88, 24);   // 옷
    g.fillStyle(hex(p.skin, 0xf0d8c0)).fillRect(56, 94, 16, 14);       // 목
    g.fillStyle(hex(p.skin, 0xf0d8c0)).fillEllipse(64, 70, 54, 62);    // 얼굴
  }

  function eyes(g, color, y = 72, w = 7, h = 9) {
    g.fillStyle(color).fillEllipse(52, y, w, h).fillEllipse(76, y, w, h);
  }

  const drawers = {
    // 적안 흑발 고양이귀 소녀
    catgirl(g, p) {
      const hair = hex(p.hair, 0x111111);
      // 귀
      g.fillStyle(hair).fillTriangle(30, 44, 36, 6, 56, 32).fillTriangle(98, 44, 92, 6, 72, 32);
      g.fillStyle(0xf2a7b5).fillTriangle(37, 36, 39, 16, 50, 31).fillTriangle(91, 36, 89, 16, 78, 31);
      // 뒷머리(긴 머리)
      g.fillStyle(hair).fillRect(32, 50, 12, 62).fillRect(84, 50, 12, 62);
      body(g, p);
      // 앞머리
      g.fillStyle(hair).fillEllipse(64, 46, 62, 36);
      g.fillTriangle(36, 52, 46, 52, 40, 70).fillTriangle(50, 52, 62, 52, 55, 66).fillTriangle(66, 52, 78, 52, 73, 66)
        .fillTriangle(82, 52, 92, 52, 88, 70);
      // 붉은 눈 + 세로 동공 + 하이라이트
      eyes(g, hex(p.eyes, 0xd62828), 74, 10, 12);
      g.fillStyle(0x1a0505).fillRect(51, 69, 2, 10).fillRect(75, 69, 2, 10);
      g.fillStyle(0xffffff).fillCircle(54, 71, 1.6).fillCircle(78, 71, 1.6);
      g.fillStyle(0x9c4a4a).fillRect(60, 89, 8, 2); // 입
    },

    // 상투 튼 남자
    topknot(g, p) {
      const hair = hex(p.hair, 0x222222);
      body(g, p);
      g.fillStyle(hair).fillEllipse(64, 46, 58, 26).fillRect(58, 22, 12, 16); // 머리 + 상투
      g.fillStyle(0xdddddd).fillRect(36, 50, 56, 6); // 머리띠
      g.fillStyle(hair).fillRect(44, 64, 14, 3).fillRect(70, 64, 14, 3); // 굵은 눈썹
      eyes(g, hex(p.eyes, 0x111111), 72, 6, 5);
      g.fillStyle(0x6b4a3a).fillRect(56, 90, 16, 2);
    },

    // 쪽진 머리 여자
    bun(g, p) {
      const hair = hex(p.hair, 0x2a1d17);
      g.fillStyle(hair).fillCircle(64, 24, 18); // 쪽
      g.fillStyle(0xff9eb8).fillCircle(82, 20, 5); // 비녀 장식
      g.fillStyle(0xd9b25a).fillRect(46, 19, 40, 3);
      body(g, p);
      g.fillStyle(hair).fillEllipse(64, 48, 60, 30).fillRect(34, 50, 8, 30).fillRect(86, 50, 8, 30);
      eyes(g, hex(p.eyes, 0x111111), 74, 6, 7);
      g.fillStyle(0xc0606a).fillRect(59, 90, 10, 2);
    },

    // 스님
    monk(g, p) {
      body(g, p);
      g.fillStyle(0x3b2a20);
      for (let i = 0; i < 9; i++) g.fillCircle(30 + i * 8.5, 110 + Math.sin(i / 8 * Math.PI) * 6, 3); // 염주
      g.lineStyle(3, 0x3a2a20).lineBetween(46, 74, 58, 74).lineBetween(70, 74, 82, 74); // 감은 눈
      g.fillStyle(0xbdbdbd).fillTriangle(50, 92, 78, 92, 64, 112); // 수염
    },

    // 카미사마 무사: 붉은 투구 + 가면
    masked(g, p) {
      body(g, p);
      const armor = hex(p.armor, 0xa31b1b);
      g.fillStyle(armor).fillEllipse(64, 46, 74, 40).fillRect(26, 46, 76, 14);
      g.fillStyle(0xd9b25a).fillTriangle(64, 30, 40, 4, 52, 30).fillTriangle(64, 30, 88, 4, 76, 30); // 투구 장식
      g.fillStyle(hex(p.skin, 0xc41f1f)).fillRect(40, 60, 48, 40); // 가면
      g.fillStyle(0x111111).fillRect(46, 70, 12, 4).fillRect(70, 70, 12, 4).fillRect(52, 88, 24, 3);
    },

    // 교주: 후광 + 흰 가면
    godmask(g, p) {
      g.lineStyle(5, 0xffd166).strokeCircle(64, 62, 56);
      g.fillStyle(hex(p.hair, 0xeeeeee)).fillRect(30, 40, 68, 70);
      body(g, p);
      g.fillStyle(hex(p.hair, 0xeeeeee)).fillEllipse(64, 44, 64, 30);
      g.fillStyle(0xd62828).fillRect(62, 48, 4, 14).fillTriangle(44, 82, 52, 82, 48, 94).fillTriangle(76, 82, 84, 82, 80, 94);
      g.fillStyle(0x111111).fillRect(46, 72, 14, 2).fillRect(68, 72, 14, 2);
      g.fillStyle(0xd62828).fillRect(58, 92, 12, 2);
    },
  };

  return {
    // characters.json 의 인물마다 'portrait-<id>' 텍스처를 준비
    generate(scene, characters) {
      for (const [id, ch] of Object.entries(characters || {})) {
        const key = 'portrait-' + id;
        if (scene.textures.exists(key) || !ch.portrait) continue;
        const draw = drawers[ch.portrait.style];
        if (!draw) continue;
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(hex(ch.portrait.bg, 0x2a2a2a)).fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
        draw(g, ch.portrait);
        g.generateTexture(key, PORTRAIT_SIZE, PORTRAIT_SIZE);
        g.destroy();
      }
    },
  };
})();
