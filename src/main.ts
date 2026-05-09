import Phaser from 'phaser';
import './styles.css';
import { Card, Lane, Owner, laneNames, lanes } from './game/cards';
import {
  GameState,
  chooseAiAction,
  createGame,
  getScores,
  passRound,
  playCard,
  startGame,
  startNextRound,
} from './game/rules';

const hud = document.querySelector<HTMLDivElement>('#hud')!;

class DuelScene extends Phaser.Scene {
  private state: GameState = createGame();
  private cardObjects = new Map<string, Phaser.GameObjects.Container>();
  private aiTimer?: Phaser.Time.TimerEvent;
  private tutorial = false;
  private tutorialStep = 0;

  constructor() {
    super('DuelScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#17120f');
    this.scale.on('resize', () => this.render());
    this.render();
  }

  private render() {
    this.children.removeAll();
    this.cardObjects.clear();

    const { width, height } = this.scale;
    this.drawTable(width, height);
    this.drawBoard(width, height);
    this.drawHands(width, height);
    this.renderHud();

    if (this.state.phase === 'playing' && this.state.active === 'ai' && !this.aiTimer) {
      this.aiTimer = this.time.delayedCall(650, () => {
        this.aiTimer = undefined;
        this.takeAiTurn();
      });
    }
  }

  private drawTable(width: number, height: number) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x2b1a17, 0x1e2526, 0x15100e, 0x0e1114, 1);
    g.fillRect(0, 0, width, height);

    g.fillStyle(0x0c0a09, 0.2);
    for (let i = 0; i < 18; i += 1) {
      g.fillRect(i * width * 0.07, 0, 2, height);
    }

    g.lineStyle(2, 0x9b7442, 0.5);
    g.strokeRoundedRect(width * 0.045, height * 0.105, width * 0.91, height * 0.73, 20);
    g.lineStyle(1, 0xe0bc68, 0.25);
    g.strokeRoundedRect(width * 0.055, height * 0.12, width * 0.89, height * 0.7, 14);

    const title = this.add.text(width * 0.5, 18, 'LINE DUEL', {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(18, Math.min(30, width * 0.025))}px`,
      color: '#e6d3a5',
    });
    title.setOrigin(0.5, 0);
    title.setLetterSpacing(2);
  }

  private drawBoard(width: number, height: number) {
    const scores = getScores(this.state);
    const boardTop = height * 0.16;
    const laneHeight = height * 0.17;
    const left = width * 0.14;
    const laneWidth = width * 0.72;

    lanes.forEach((lane, index) => {
      const y = boardTop + index * (laneHeight + 8);
      const weather = this.state.weather[lane];
      const g = this.add.graphics();
      g.fillStyle(weather ? 0x203d4b : 0x2d221a, 0.92);
      g.fillRoundedRect(left, y, laneWidth, laneHeight, 12);
      g.fillStyle(0x0b0807, 0.25);
      g.fillRoundedRect(left + 7, y + laneHeight * 0.49, laneWidth - 14, 2, 1);
      g.lineStyle(1, weather ? 0xb8e6ef : 0x9c7544, 0.85);
      g.strokeRoundedRect(left, y, laneWidth, laneHeight, 12);

      this.add
        .text(left + 14, y + 10, `${laneNames[lane]}${weather ? ' / 天气' : ''}`, {
          fontSize: '15px',
          color: weather ? '#c9eef2' : '#e7d4a9',
          fontFamily: 'system-ui, sans-serif',
        })
        .setDepth(3);

      this.drawLaneCards('ai', lane, left + 108, y + 10, laneWidth - 210, laneHeight * 0.42);
      this.drawLaneCards('player', lane, left + 108, y + laneHeight * 0.52, laneWidth - 210, laneHeight * 0.42);
      this.drawPersistentLaneEffects(lane, left, y, laneWidth, laneHeight);

      this.drawScorePip(left + laneWidth - 72, y + 14, scores.lanes.ai[lane], '电脑');
      this.drawScorePip(left + laneWidth - 72, y + laneHeight - 42, scores.lanes.player[lane], '你');
    });

    this.drawTotalScore(width * 0.065, height * 0.25, scores.total.ai, '电脑');
    this.drawTotalScore(width * 0.065, height * 0.58, scores.total.player, '你');
  }

  private drawHands(width: number, height: number) {
    const aiHandCount = this.state.hands.ai.length;
    for (let i = 0; i < aiHandCount; i += 1) {
      this.drawCardBack(width * 0.23 + i * 27, height * 0.085, 44, 58);
    }

    const hand = this.state.hands.player;
    const cardW = Math.max(64, Math.min(92, width / 11));
    const cardH = cardW * 1.34;
    const gap = Math.max(6, Math.min(12, width * 0.009));
    const totalWidth = hand.length * cardW + (hand.length - 1) * gap;
    let startX = Math.max(16, (width - totalWidth) / 2);
    const maxRight = width - 16;
    if (startX + totalWidth > maxRight) startX = 16;

    hand.forEach((card, index) => {
      const x = startX + index * (cardW + gap);
      const y = height - cardH - 18;
      const c = this.drawCard(card, x, y, cardW, cardH, 'player', true);
      c.setDepth(10 + index);
    });
  }

  private drawLaneCards(owner: Owner, lane: Lane, x: number, y: number, width: number, height: number) {
    const cards = this.state.board[owner][lane];
    const cardW = Math.max(38, Math.min(58, width / 8));
    const gap = 6;
    cards.slice(-8).forEach((card, index) => {
      this.drawMiniCard(card, x + index * (cardW + gap), y, cardW, height);
    });
  }

  private drawCard(card: Card, x: number, y: number, width: number, height: number, owner: Owner, interactive: boolean) {
    const container = this.add.container(x, y);
    const palette = this.cardPalette(card);
    const bg = this.add.graphics();
    bg.fillStyle(palette.shadow, 1);
    bg.fillRoundedRect(3, 5, width, height, 8);
    bg.fillStyle(palette.base, 1);
    bg.fillRoundedRect(0, 0, width, height, 8);
    bg.fillStyle(palette.art, 1);
    bg.fillRoundedRect(8, 28, width - 16, height * 0.38, 6);
    bg.fillStyle(0xffffff, 0.09);
    bg.fillTriangle(10, 30, width - 10, 30, 10, 30 + height * 0.38);
    bg.lineStyle(2, owner === 'player' ? 0xf1cf73 : 0xaab5c4, 1);
    bg.strokeRoundedRect(0, 0, width, height, 8);
    bg.lineStyle(1, 0xffffff, 0.14);
    bg.strokeRoundedRect(6, 6, width - 12, height - 12, 5);

    const name = this.add.text(8, 8, card.name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(11, width * 0.13)}px`,
      color: '#fff3c9',
      wordWrap: { width: width - 16 },
    });
    const symbol = this.add.text(width * 0.5, height * 0.35, this.cardSymbol(card), {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(24, width * 0.38)}px`,
      color: '#fff0c8',
      stroke: '#160d09',
      strokeThickness: 3,
    });
    symbol.setOrigin(0.5);
    const rule = this.add.text(8, height * 0.58, this.shortRule(card), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(9, width * 0.1)}px`,
      color: '#f4dfb4',
      wordWrap: { width: width - 16 },
      lineSpacing: -2,
    });
    const power = this.add.text(width - 11, height - 9, `${card.power}`, {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(22, width * 0.34)}px`,
      color: '#f2d27a',
    });
    power.setOrigin(1, 1);
    const lane = this.add.text(8, height - 30, laneNames[card.lane], {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(10, width * 0.12)}px`,
      color: '#e5cfa1',
    });
    const kind = this.add.text(8, height * 0.48, this.kindLabel(card), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(10, width * 0.11)}px`,
      color: '#f7ead0',
    });

    container.add([bg, name, symbol, rule, power, lane, kind]);
    container.setSize(width, height);

    if (interactive && this.state.phase === 'playing' && this.state.active === 'player' && !this.state.playerPassed) {
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => {
        container.setY(y - 12);
        this.showCardTip(card);
      });
      container.on('pointerout', () => {
        container.setY(y);
        this.renderHud();
      });
      container.on('pointerup', () => {
        const played = card;
        this.state = playCard(this.state, 'player', card.instanceId);
        this.soundClick();
        this.render();
        this.playCardEffect(played, 'player');
        this.advanceTutorialAfterPlayerAction(played);
      });
    }

    this.cardObjects.set(card.instanceId, container);
    return container;
  }

  private drawMiniCard(card: Card, x: number, y: number, width: number, height: number) {
    const c = this.add.container(x, y);
    const palette = this.cardPalette(card);
    const bg = this.add.graphics();
    bg.fillStyle(palette.base, 1);
    bg.fillRoundedRect(0, 0, width, height, 6);
    bg.fillStyle(palette.art, 0.8);
    bg.fillRoundedRect(5, 6, width - 10, height * 0.42, 4);
    bg.lineStyle(1, 0xe0bc68, 0.75);
    bg.strokeRoundedRect(0, 0, width, height, 6);
    const p = this.add.text(width - 7, height - 5, `${card.power}`, {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(15, width * 0.42)}px`,
      color: '#f7d777',
    });
    p.setOrigin(1, 1);
    const n = this.add.text(6, 6, card.name.slice(0, 3), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#fff1c5',
    });
    const s = this.add.text(width * 0.5, height * 0.38, this.cardSymbol(card), {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(12, width * 0.28)}px`,
      color: '#fff0c8',
      stroke: '#130c08',
      strokeThickness: 2,
    });
    s.setOrigin(0.5);
    c.add([bg, p, n, s]);
  }

  private drawCardBack(x: number, y: number, width: number, height: number) {
    const g = this.add.graphics();
    g.fillStyle(0x14181f, 1);
    g.fillRoundedRect(x + 3, y + 4, width, height, 6);
    g.fillStyle(0x242c37, 1);
    g.fillRoundedRect(x, y, width, height, 6);
    g.lineStyle(1, 0x9aa3b2, 0.7);
    g.strokeRoundedRect(x, y, width, height, 6);
    g.lineStyle(1, 0xd8b75f, 0.8);
    g.strokeRoundedRect(x + 9, y + 9, width - 18, height - 18, 4);
    g.fillStyle(0xd8b75f, 0.28);
    g.fillCircle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.14);
  }

  private drawScorePip(x: number, y: number, score: number, label: string) {
    const g = this.add.graphics();
    g.fillStyle(0x14110f, 0.82);
    g.fillRoundedRect(x, y, 58, 30, 15);
    this.add.text(x + 9, y + 6, `${label} ${score}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#f3e1b2',
    });
  }

  private drawTotalScore(x: number, y: number, score: number, label: string) {
    const g = this.add.graphics();
    g.fillStyle(0x0f0d0b, 0.72);
    g.fillRoundedRect(x, y, 72, 72, 14);
    g.lineStyle(1, 0xd8b75f, 0.65);
    g.strokeRoundedRect(x, y, 72, 72, 14);
    this.add.text(x + 36, y + 12, label, { fontSize: '14px', color: '#d7c092', fontFamily: 'system-ui' }).setOrigin(0.5, 0);
    this.add.text(x + 36, y + 29, `${score}`, { fontSize: '30px', color: '#f4d06f', fontFamily: 'Georgia' }).setOrigin(0.5, 0);
  }

  private renderHud(tip?: string) {
    const scores = getScores(this.state);
    const canAct = this.state.phase === 'playing' && this.state.active === 'player' && !this.state.playerPassed;
    const status =
      this.state.phase === 'gameOver'
        ? this.state.winner === 'draw'
          ? '平局'
          : this.state.winner === 'player'
            ? '你赢了'
            : '电脑获胜'
        : this.state.phase === 'roundEnd'
          ? '本局结束'
          : this.state.active === 'player'
            ? '你的回合'
            : '电脑思考中';

    const tutorialText = this.tutorial ? this.getTutorialText() : '';
    hud.innerHTML = `
      <div class="topbar">
        <div class="brand">
          <strong>Line Duel</strong>
          <span>${this.tutorial ? '教学关卡' : `第 ${this.state.round} 局`} · ${status}</span>
        </div>
        <div class="wins">
          <span>你 ${this.state.playerWins}</span>
          <span>电脑 ${this.state.aiWins}</span>
          <span>总分 ${scores.total.player}:${scores.total.ai}</span>
        </div>
      </div>
      <div class="message">${tip ?? this.state.message}</div>
      ${tutorialText ? `<div class="tutorial">${tutorialText}</div>` : ''}
      <div class="controls">
        ${
          this.state.phase === 'menu'
            ? '<button data-action="tutorial">教学关卡</button><button data-action="start">开始对战</button>'
            : this.state.phase === 'roundEnd'
              ? '<button data-action="next">继续下一局</button>'
              : this.state.phase === 'gameOver'
                ? '<button data-action="restart">再来一局</button>'
                : `<button data-action="pass" ${canAct ? '' : 'disabled'}>跳过本局</button>`
        }
      </div>
    `;

    hud.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      this.tutorial = false;
      this.tutorialStep = 0;
      this.state = startGame(this.state);
      this.soundClick();
      this.render();
    });
    hud.querySelector('[data-action="tutorial"]')?.addEventListener('click', () => {
      this.tutorial = true;
      this.tutorialStep = 0;
      this.state = startGame(createGame());
      this.state.message = '教学开始：先打一张单位牌，看看它如何进入对应战线。';
      this.soundClick();
      this.render();
    });
    hud.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      this.state = startNextRound(this.state);
      this.soundClick();
      this.render();
    });
    hud.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
      this.tutorial = false;
      this.tutorialStep = 0;
      this.state = startGame(createGame());
      this.soundClick();
      this.render();
    });
    hud.querySelector('[data-action="pass"]')?.addEventListener('click', () => {
      this.state = passRound(this.state, 'player');
      if (this.tutorial) this.tutorialStep = Math.max(this.tutorialStep, 4);
      this.soundClick();
      this.render();
    });
  }

  private showCardTip(card: Card) {
    this.renderHud(`${card.name}：${card.text}`);
  }

  private takeAiTurn() {
    if (this.state.phase !== 'playing' || this.state.active !== 'ai') return;
    const action = chooseAiAction(this.state);
    const played = action.type === 'play' ? this.state.hands.ai.find((card) => card.instanceId === action.cardId) : undefined;
    this.state = action.type === 'pass' ? passRound(this.state, 'ai') : playCard(this.state, 'ai', action.cardId);
    this.soundClick();
    this.render();
    if (played) this.playCardEffect(played, 'ai');
  }

  private kindLabel(card: Card) {
    if (card.kind === 'weather') return '天气';
    if (card.kind === 'banner') return '旗手';
    if (card.kind === 'scout') return '探子';
    return '单位';
  }

  private soundClick() {
    // Prototype audio placeholder: keep the call site so real SFX can drop in later.
  }

  private cardPalette(card: Card) {
    if (card.kind === 'weather') return { base: 0x243f4c, art: 0x5b8ea0, shadow: 0x0d1a20 };
    if (card.kind === 'banner') return { base: 0x5b3425, art: 0xb58345, shadow: 0x20100b };
    if (card.kind === 'scout') return { base: 0x2c4b39, art: 0x74a46b, shadow: 0x0e1c14 };
    if (card.lane === 'front') return { base: 0x6b3029, art: 0xa84a38, shadow: 0x210e0b };
    if (card.lane === 'range') return { base: 0x4b4630, art: 0x8f8747, shadow: 0x17150d };
    return { base: 0x3f3f4d, art: 0x73758f, shadow: 0x11121a };
  }

  private cardSymbol(card: Card) {
    if (card.kind === 'weather') return 'W';
    if (card.kind === 'banner') return '+';
    if (card.kind === 'scout') return '?';
    if (card.lane === 'front') return 'I';
    if (card.lane === 'range') return 'A';
    return 'T';
  }

  private shortRule(card: Card) {
    if (card.kind === 'weather') return '持续：双方本战线单位最多计 2 点';
    if (card.kind === 'banner') return '持续：己方本战线单位 +1';
    if (card.kind === 'scout') return '出牌：抽 1 张牌';
    return '部署到对应战线';
  }

  private drawPersistentLaneEffects(lane: Lane, x: number, y: number, width: number, height: number) {
    if (this.state.weather[lane]) {
      const color = lane === 'range' ? 0x9fd8e6 : 0x9fb0c2;
      const veil = this.add.rectangle(x + width * 0.5, y + height * 0.5, width - 22, height - 14, color, 0.06).setDepth(4);
      this.tweens.add({ targets: veil, alpha: 0.11, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      for (let i = 0; i < 7; i += 1) {
        const px = x + 38 + ((i * 137) % (width - 90));
        const line = this.add.rectangle(px, y + 18 + ((i * 19) % Math.max(30, height - 36)), 58, 2, color, 0.22).setDepth(5);
        line.setRotation(-0.16);
        this.tweens.add({
          targets: line,
          x: px + 48,
          alpha: 0.05,
          duration: 900 + i * 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    (['ai', 'player'] as Owner[]).forEach((owner) => {
      const hasBanner = this.state.board[owner][lane].some((card) => card.kind === 'banner');
      if (!hasBanner) return;
      const cy = owner === 'ai' ? y + height * 0.27 : y + height * 0.74;
      const glow = this.add.rectangle(x + width * 0.51, cy, width - 240, 20, 0xf0c96d, 0.08).setDepth(6);
      this.tweens.add({ targets: glow, alpha: 0.18, scaleX: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      for (let i = 0; i < 4; i += 1) {
        const sparkX = x + 128 + ((i * 211) % Math.max(120, width - 300));
        const spark = this.add.circle(sparkX, cy - 8 + i * 5, 2, 0xf8dd8d, 0.55).setDepth(7);
        this.tweens.add({
          targets: spark,
          y: spark.y - 14,
          alpha: 0.05,
          duration: 680 + i * 110,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }

  private playCardEffect(card: Card, owner: Owner) {
    const { width, height } = this.scale;
    const laneIndex = lanes.indexOf(card.lane);
    const x = width * 0.5;
    const laneY = height * 0.16 + laneIndex * (height * 0.17 + 8) + height * 0.085;
    const y = owner === 'player' ? laneY + height * 0.045 : laneY - height * 0.045;

    if (card.kind === 'weather') {
      this.weatherEffect(y, card.lane);
    } else if (card.kind === 'banner') {
      this.bannerEffect(x, y);
    } else if (card.kind === 'scout') {
      this.scoutEffect(x, y, owner);
    } else {
      this.unitEffect(x, y, card.power);
    }
  }

  private unitEffect(x: number, y: number, power: number) {
    const ring = this.add.circle(x, y, 18, 0xf0c96d, 0.2).setDepth(60);
    const text = this.add.text(x, y, `+${power}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      color: '#f7d777',
      stroke: '#140c08',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(61);
    this.tweens.add({ targets: ring, radius: 72, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.tweens.add({ targets: text, y: y - 28, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
  }

  private weatherEffect(y: number, lane: Lane) {
    const { width } = this.scale;
    const color = lane === 'range' ? 0xa6dce8 : 0x8aa1b4;
    const sweep = this.add.rectangle(-width * 0.2, y, width * 0.24, 96, color, 0.22).setDepth(58);
    this.tweens.add({ targets: sweep, x: width * 1.2, duration: 620, ease: 'Sine.easeInOut', onComplete: () => sweep.destroy() });
    for (let i = 0; i < 14; i += 1) {
      const drop = this.add.rectangle(Math.random() * width, y - 44 + Math.random() * 80, 2, 18, color, 0.75).setDepth(59);
      this.tweens.add({ targets: drop, x: drop.x + 24, y: drop.y + 38, alpha: 0, duration: 500 + Math.random() * 260, onComplete: () => drop.destroy() });
    }
  }

  private bannerEffect(x: number, y: number) {
    const beam = this.add.rectangle(x, y, 7, 84, 0xf6d06c, 0.75).setDepth(60);
    const label = this.add.text(x + 16, y - 12, '战线鼓舞', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffe6a6',
      stroke: '#140c08',
      strokeThickness: 3,
    }).setDepth(61);
    this.tweens.add({ targets: beam, scaleY: 1.4, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => beam.destroy() });
    this.tweens.add({ targets: label, y: y - 34, alpha: 0, duration: 760, onComplete: () => label.destroy() });
  }

  private scoutEffect(x: number, y: number, owner: Owner) {
    const targetY = owner === 'player' ? this.scale.height - 82 : 72;
    const dot = this.add.circle(x, y, 7, 0x9edc7f, 1).setDepth(62);
    const label = this.add.text(x + 12, y - 16, '抽牌', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#d8ffc9',
      stroke: '#102010',
      strokeThickness: 3,
    }).setDepth(62);
    this.tweens.add({ targets: dot, y: targetY, x: x + 90, alpha: 0, duration: 620, ease: 'Cubic.easeInOut', onComplete: () => dot.destroy() });
    this.tweens.add({ targets: label, y: y - 36, alpha: 0, duration: 700, onComplete: () => label.destroy() });
  }

  private getTutorialText() {
    const copy = [
      '<strong>教学 1/4</strong><span>每张牌会进入它标记的战线。先打一张单位牌，观察总分变化。</span>',
      '<strong>教学 2/4</strong><span>天气牌会压低同一战线双方单位的点数，适合反制对手堆分。</span>',
      '<strong>教学 3/4</strong><span>旗手会鼓舞己方同战线单位；探子点数低，但能补一张手牌。</span>',
      '<strong>教学 4/4</strong><span>觉得这一局够赢，或想保留强牌时，点击“跳过本局”。双方都跳过后结算。</span>',
      '<strong>教学完成</strong><span>继续打完这局，目标是三局两胜。</span>',
    ];
    return copy[Math.min(this.tutorialStep, copy.length - 1)];
  }

  private advanceTutorialAfterPlayerAction(card: Card) {
    if (!this.tutorial) return;
    if (this.tutorialStep === 0 && card.kind === 'unit') this.tutorialStep = 1;
    else if (this.tutorialStep === 1 && card.kind === 'weather') this.tutorialStep = 2;
    else if (this.tutorialStep === 2 && (card.kind === 'banner' || card.kind === 'scout')) this.tutorialStep = 3;
    else if (this.tutorialStep < 3) this.tutorialStep += 1;
    this.renderHud();
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14110f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [DuelScene],
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
