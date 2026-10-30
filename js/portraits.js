// 대화창 임시 초상화: 도트 초상화(sprite)나 그림(image)이 없는 인물은
// 검은 실루엣 + 이름 첫 글자로 그린다. 머리 모양은 characters.json 의 portrait.style 로 조금씩 다르게.
// 그림이 생기면 characters.json 에서 그 인물에 "image": "assets/xxx.png" 나 sprite 를 넣으면 된다.
const Portraits = (function () {
  const SIZE = 400; // 화면에는 200px 로 보인다 (선명하게 2배로 그림)
  const cache = {};

  // 머리 모양별 실루엣 (400×400 기준)
  const hair = {
    catgirl(g) { // 고양이귀
      g.moveTo(130, 150); g.lineTo(140, 50); g.lineTo(195, 110); g.closePath();
      g.moveTo(270, 150); g.lineTo(260, 50); g.lineTo(205, 110); g.closePath();
    },
    bun(g) { g.moveTo(240, 85); g.arc(200, 85, 40, 0, Math.PI * 2); }, // 쪽진 머리
    topknot(g) { g.rect(185, 70, 30, 50); },                          // 상투
    monk() {},                                                          // 민머리
    masked(g) { // 투구 뿔
      g.moveTo(150, 130); g.lineTo(105, 45); g.lineTo(185, 115); g.closePath();
      g.moveTo(250, 130); g.lineTo(295, 45); g.lineTo(215, 115); g.closePath();
    },
    godmask(g) { g.rect(120, 150, 160, 170); }, // 긴 흰 머리 (실루엣이라 검게)
  };

  function draw(ch) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const color = ch.color || '#8a8496';
    // 배경: 인물 색이 은은하게 번진 남색
    const bg = g.createRadialGradient(200, 170, 20, 200, 200, 280);
    bg.addColorStop(0, color + '66');
    bg.addColorStop(1, '#0d112b');
    g.fillStyle = '#0d112b';
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = bg;
    g.fillRect(0, 0, SIZE, SIZE);

    // 실루엣: 머리 + 목 + 어깨
    g.fillStyle = '#05060f';
    g.beginPath();
    g.ellipse(200, 175, 72, 82, 0, 0, Math.PI * 2);
    (hair[ch.portrait && ch.portrait.style] || (() => {}))(g);
    g.fill();
    g.beginPath();
    g.rect(175, 240, 50, 50);
    g.moveTo(40, SIZE);
    g.bezierCurveTo(50, 300, 120, 275, 200, 275);
    g.bezierCurveTo(280, 275, 350, 300, 360, SIZE);
    g.closePath();
    g.fill();
    // 윤곽선
    g.strokeStyle = color + 'aa';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(200, 175, 72, 82, 0, 0, Math.PI * 2);
    g.stroke();

    // 이름 첫 글자
    const initial = [...(ch.name || '?')][0];
    g.font = '700 120px "Gowun Batang", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f3eee4';
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillText(initial, 200, 182);
    return c.toDataURL();
  }

  return {
    // 실루엣 그림(data URL). 대사 글꼴이 아직 안 읽혔으면 임시로 그리고 다음에 다시 그린다
    silhouette(id, ch) {
      if (cache[id]) return cache[id];
      const url = draw(ch);
      if (!document.fonts || document.fonts.check('700 120px "Gowun Batang"')) cache[id] = url;
      return url;
    },
  };
})();
