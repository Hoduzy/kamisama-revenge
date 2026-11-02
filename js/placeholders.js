// 아직 그림이 없는 것(새 배경 · 소품 · 인물)을 같은 크기의 단색 그림 + 이름표로 임시 표시한다.
// 그림을 assets/raw/ 에 올려 tools/process_*.py 로 manifest(assets/sprites/manifest.json)에 같은 이름으로 넣으면
// 게임이 자동으로 그 그림을 쓴다 (임시 그림은 manifest 에 그 이름이 없을 때만 만든다).
// 이름 목록: docs/prologue-assets.md
const PLACEHOLDER = {
  // 배경 (화면 크기 960×540, 구역 배경 자리에 고정)
  backgrounds: {
    bg_pro_room: { label: '아카네의 방', color: '#3b2b22', kind: 'interior' },
    bg_pro_house: { label: '집 마당 (죽은 묘목)', color: '#46553a', kind: 'yard' },
    bg_pro_irori: { label: '이로리 · 아침 밥상', color: '#3a2a20', kind: 'interior' },
    bg_pro_village: { label: '마을 길 (만두 가게 · 신사 · 우물)', color: '#56687a', kind: 'village' },
    bg_pro_gate: { label: '마을 입구 (돌 도리이 · 석등)', color: '#4b5a68', kind: 'gate' },
    bg_pro_cave: { label: '뒷산 동굴 · 새벽 비', color: '#1d2126', kind: 'cave' },
    bg_pro_grave: { label: '큰 벚나무 아래 · 검게 탄 그루터기', color: '#2a2c31', kind: 'grave' },
  },
  // 소품 (월드 좌표, 발 기준). w·h = 화면 px
  props: {
    prop_bed: { label: '이불', w: 120, h: 18, color: '#c8b8a0' },
    prop_sapling: { label: '죽은 묘목', w: 22, h: 46, color: '#5a4636' },
    prop_letter: { label: '접힌 편지', w: 14, h: 10, color: '#efe4c8' },
    prop_irori: { label: '이로리(화로) · 밥상', w: 180, h: 30, color: '#4a3020' },
    prop_steamer: { label: '만두 찜통', w: 40, h: 30, color: '#b89a70' },
    prop_well: { label: '우물', w: 60, h: 40, color: '#6a6a70' },
    prop_shrine: { label: '신사', w: 90, h: 110, color: '#8a2a24' },
    prop_torii: { label: '돌 도리이', w: 120, h: 150, color: '#7a7a74' },
    prop_lantern_stone: { label: '석등', w: 26, h: 60, color: '#86867e' },
    prop_stone: { label: '나그네가 앉은 돌', w: 56, h: 22, color: '#6e6e66' },
    prop_petal: { label: '', w: 8, h: 6, color: '#ffb7c5' },
    prop_bell: { label: '붉은 방울', w: 12, h: 12, color: '#d62828' },
    prop_hat: { label: '삿갓', w: 54, h: 18, color: '#c9a86a' },
    prop_flower: { label: '아카네가 피운 꽃', w: 14, h: 14, color: '#ff8fb1' },
    prop_lantern_rope: { label: '등롱 줄', w: 260, h: 26, color: '#d8643a' },
    prop_pillar: { label: '무너진 노점 기둥', w: 110, h: 22, color: '#5a3a28' },
    prop_mask_broken: { label: '깨진 고양이귀 가면', w: 18, h: 14, color: '#f0e8dc' },
    prop_haru_sword: { label: '하루의 칼', w: 56, h: 6, color: '#c8c8d0' },
    prop_hairpin: { label: '붉은 술 비녀', w: 18, h: 8, color: '#c03040' },
    prop_grave: { label: '돌무덤', w: 30, h: 26, color: '#6a6a6a' },
    prop_stump: { label: '검게 탄 그루터기', w: 150, h: 120, color: '#1a1414' },
    prop_hammer: { label: '망치', w: 26, h: 14, color: '#5a5a60' },
    prop_cloth_bell: { label: '천으로 감싼 방울', w: 14, h: 14, color: '#8a7a6a' },
    prop_sword_gift: { label: '검은 칼집의 칼', w: 70, h: 8, color: '#1a1a1e' },
    prop_rooftop_cultist: { label: '흰 가면 신도', w: 22, h: 56, color: '#e8e4dc' },
  },
};

const Placeholders = {
  // 구역 배경: 단색 + 장소 실루엣 + 이름표 (화면 크기)
  background(scene, key) {
    if (scene.textures.exists(key)) return key;
    const d = PLACEHOLDER.backgrounds[key] || { label: key, color: '#333344', kind: 'village' };
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const tex = scene.textures.createCanvas(key, W, H);
    const g = tex.getContext();
    const base = Phaser.Display.Color.HexStringToColor(d.color);
    const shade = (k) => `rgb(${Math.round(base.red * k)},${Math.round(base.green * k)},${Math.round(base.blue * k)})`;
    g.fillStyle = shade(1);
    g.fillRect(0, 0, W, H);
    g.fillStyle = shade(1.25);
    g.fillRect(0, 0, W, H * 0.45);
    g.fillStyle = shade(0.6);
    const floor = H - 92; // 땅 윗면 (맵 바닥 620 이 화면 아래 92px 위)
    // 장소 실루엣 (단색)
    if (d.kind === 'interior') {
      for (let x = 40; x < W; x += 150) g.fillRect(x, 60, 8, floor - 60);           // 기둥
      g.fillRect(0, 60, W, 10);                                                     // 들보
      g.fillStyle = shade(0.8);
      for (let x = 70; x < W - 60; x += 150) g.fillRect(x, 120, 100, 160);          // 장지문
    } else if (d.kind === 'village' || d.kind === 'yard') {
      for (let x = -20; x < W; x += 190) {
        g.beginPath(); g.moveTo(x, floor - 150); g.lineTo(x + 95, floor - 220); g.lineTo(x + 190, floor - 150); g.closePath(); g.fill();
        g.fillRect(x + 20, floor - 150, 150, 150);
      }
    } else if (d.kind === 'gate') {
      g.fillRect(380, floor - 230, 18, 230); g.fillRect(560, floor - 230, 18, 230);
      g.fillRect(350, floor - 240, 260, 16); g.fillRect(370, floor - 200, 220, 10);
      for (let x = 0; x < W; x += 60) g.fillRect(x, floor - 260 - (x % 120 ? 40 : 0), 44, 260);
    } else if (d.kind === 'cave') {
      g.fillStyle = shade(0.35);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, floor); g.lineTo(W - 160, floor); g.quadraticCurveTo(W / 2, 40, 160, floor); g.lineTo(0, floor); g.closePath(); g.fill();
    } else if (d.kind === 'grave') {
      g.fillRect(W / 2 - 80, floor - 130, 160, 130);
      for (let i = 0; i < 7; i++) g.fillRect(W / 2 - 120 + i * 40, floor - 150 - (i % 3) * 20, 10, 40);
    }
    g.fillStyle = shade(0.45);
    g.fillRect(0, floor, W, H - floor);
    // 이름표
    // 레터박스(위 58px)와 목표 자막(왼쪽 위)에 가리지 않게 오른쪽 위, 조금 아래
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(W - 536, 72, 520, 52);
    g.font = `16px ${PixelFont.STACK}`;
    g.fillStyle = '#f5e6c8';
    g.textBaseline = 'top';
    g.fillText(`배경 준비 중 · ${d.label}`, W - 524, 80);
    g.fillStyle = '#b8b0a0';
    g.fillText(`${key}.png 를 넣으면 바뀜`, W - 524, 100);
    PixelFont.crisp(tex.getSourceImage(), g);
    tex.refresh();
    return key;
  },

  // 소품: 단색 네모 (먹색 테두리). 이름표는 PropDirector 가 HTML 로
  prop(scene, key, w, h, color) {
    if (scene.textures.exists(key) && Sprites.sheet(key)) return { key, real: true };
    const d = PLACEHOLDER.props[key] || {};
    const ph = `ph-${key}`;
    if (!scene.textures.exists(ph)) {
      const W = Math.max(2, Math.round(w ?? d.w ?? 24));
      const H = Math.max(2, Math.round(h ?? d.h ?? 24));
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x1a1214).fillRect(0, 0, W, H);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(color || d.color || '#888888').color).fillRect(1, 1, W - 2, H - 2);
      g.generateTexture(ph, W, H);
      g.destroy();
    }
    return { key: ph, real: false, label: d.label ?? key };
  },
};
