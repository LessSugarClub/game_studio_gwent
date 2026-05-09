import { Card, Lane, Owner, createDeck, lanes } from './cards';

export type Board = Record<Owner, Record<Lane, Card[]>>;

export type GameState = {
  phase: 'menu' | 'playing' | 'roundEnd' | 'gameOver';
  round: number;
  active: Owner;
  playerPassed: boolean;
  aiPassed: boolean;
  playerWins: number;
  aiWins: number;
  decks: Record<Owner, Card[]>;
  hands: Record<Owner, Card[]>;
  board: Board;
  weather: Partial<Record<Lane, boolean>>;
  message: string;
  winner?: Owner | 'draw';
  lastPlayed?: { owner: Owner; card: Card };
};

export type Scores = {
  lanes: Record<Owner, Record<Lane, number>>;
  total: Record<Owner, number>;
};

const emptyLane = (): Record<Lane, Card[]> => ({ front: [], range: [], siege: [] });

export function createGame(): GameState {
  const playerDeck = createDeck('player');
  const aiDeck = createDeck('ai');
  return {
    phase: 'menu',
    round: 1,
    active: 'player',
    playerPassed: false,
    aiPassed: false,
    playerWins: 0,
    aiWins: 0,
    decks: {
      player: playerDeck.slice(8),
      ai: aiDeck.slice(8),
    },
    hands: {
      player: playerDeck.slice(0, 8),
      ai: aiDeck.slice(0, 8),
    },
    board: {
      player: emptyLane(),
      ai: emptyLane(),
    },
    weather: {},
    message: '三局两胜。每回合出一张牌，觉得够了就跳过。',
  };
}

export function startGame(state: GameState): GameState {
  return { ...state, phase: 'playing', message: '你先手。选择一张手牌出牌，或跳过本局。' };
}

export function playCard(state: GameState, owner: Owner, cardId: string): GameState {
  if (state.phase !== 'playing' || state.active !== owner || hasPassed(state, owner)) return state;
  const card = state.hands[owner].find((item) => item.instanceId === cardId);
  if (!card) return state;

  const hands = cloneHands(state);
  hands[owner] = hands[owner].filter((item) => item.instanceId !== cardId);
  const board = cloneBoard(state);
  const weather = { ...state.weather };

  if (card.kind === 'weather') {
    weather[card.lane] = true;
  } else {
    board[owner][card.lane] = [...board[owner][card.lane], card];
  }

  if (card.kind === 'scout' && state.decks[owner].length > 0) {
    const decks = cloneDecks(state);
    const drawn = decks[owner][0];
    decks[owner] = decks[owner].slice(1);
    hands[owner] = [...hands[owner], drawn];
    return afterAction({
      ...state,
      hands,
      decks,
      board,
      weather,
      lastPlayed: { owner, card },
      message: `${nameOf(owner)}打出「${card.name}」，并抽了一张牌。`,
    });
  }

  return afterAction({
    ...state,
    hands,
    board,
    weather,
    lastPlayed: { owner, card },
    message: `${nameOf(owner)}打出「${card.name}」。`,
  });
}

export function passRound(state: GameState, owner: Owner): GameState {
  if (state.phase !== 'playing' || state.active !== owner || hasPassed(state, owner)) return state;
  const next = {
    ...state,
    playerPassed: owner === 'player' ? true : state.playerPassed,
    aiPassed: owner === 'ai' ? true : state.aiPassed,
    message: `${nameOf(owner)}跳过本局。`,
  };
  return afterAction(next);
}

export function startNextRound(state: GameState): GameState {
  if (state.phase === 'gameOver') return state;
  const decks = cloneDecks(state);
  const hands = cloneHands(state);
  (['player', 'ai'] as Owner[]).forEach((owner) => {
    if (decks[owner].length > 0) {
      hands[owner] = [...hands[owner], decks[owner][0]];
      decks[owner] = decks[owner].slice(1);
    }
  });

  return {
    ...state,
    phase: 'playing',
    round: state.round + 1,
    active: state.round % 2 === 1 ? 'ai' : 'player',
    playerPassed: false,
    aiPassed: false,
    decks,
    hands,
    board: { player: emptyLane(), ai: emptyLane() },
    weather: {},
    message: '新一局开始。双方各抽一张牌。',
    winner: undefined,
    lastPlayed: undefined,
  };
}

export function getScores(state: GameState): Scores {
  const laneScores = {
    player: emptyScores(),
    ai: emptyScores(),
  };

  (['player', 'ai'] as Owner[]).forEach((owner) => {
    lanes.forEach((lane) => {
      const bannerBonus = state.board[owner][lane].some((card) => card.kind === 'banner') ? 1 : 0;
      laneScores[owner][lane] = state.board[owner][lane].reduce((sum, card) => {
        const capped = state.weather[lane] ? Math.min(card.power, 2) : card.power;
        return sum + capped + (card.kind === 'unit' ? bannerBonus : 0);
      }, 0);
    });
  });

  return {
    lanes: laneScores,
    total: {
      player: lanes.reduce((sum, lane) => sum + laneScores.player[lane], 0),
      ai: lanes.reduce((sum, lane) => sum + laneScores.ai[lane], 0),
    },
  };
}

export function chooseAiAction(state: GameState): { type: 'play'; cardId: string } | { type: 'pass' } {
  const scores = getScores(state);
  const hand = state.hands.ai;
  if (hand.length === 0) return { type: 'pass' };

  const scoreDelta = scores.total.ai - scores.total.player;
  const evaluated = hand
    .map((card) => ({ card, value: evaluateAiCard(state, card) }))
    .sort((a, b) => b.value - a.value);
  const best = evaluated[0];
  const cheapestWin = [...evaluated]
    .filter(({ value }) => scoreDelta + value > 0)
    .sort((a, b) => a.value - b.value)[0];
  const lowCard = [...evaluated].sort((a, b) => a.value - b.value)[0];
  const strongestPower = Math.max(...hand.map((card) => card.power));
  const pressure = getAiPressure(state);

  if (state.playerPassed && scoreDelta > 0) return { type: 'pass' };
  if (state.playerPassed && cheapestWin) {
    return { type: 'play', cardId: cheapestWin.card.instanceId };
  }
  if (state.playerPassed) return { type: 'pass' };

  if (pressure !== 'mustWin' && hand.length <= 4 && scoreDelta < -10) return { type: 'pass' };
  if (pressure !== 'mustWin' && scoreDelta > 0 && hand.length <= state.hands.player.length) return { type: 'pass' };
  if (pressure === 'ahead' && scoreDelta >= 7 && hand.length <= 5) return { type: 'pass' };
  if (pressure === 'neutral' && scoreDelta < -14 && hand.length <= 6) return { type: 'pass' };

  if (best.card.kind === 'weather' && best.value < 3) {
    return { type: 'play', cardId: lowCard.card.instanceId };
  }
  if (pressure !== 'mustWin' && best.card.power === strongestPower && scoreDelta > -3 && hand.length <= 5) {
    const efficient = evaluated.find(({ card, value }) => card.power < strongestPower && value >= 3);
    if (efficient) return { type: 'play', cardId: efficient.card.instanceId };
  }

  return { type: 'play', cardId: best.card.instanceId };
}

function afterAction(state: GameState): GameState {
  if (state.playerPassed && state.aiPassed) {
    return settleRound(state);
  }
  if (state.playerPassed && state.active === 'ai') return state;
  if (state.aiPassed && state.active === 'player') return state;
  const nextActive = state.active === 'player' ? 'ai' : 'player';
  if (hasPassed(state, nextActive)) return { ...state, active: state.active };
  return { ...state, active: nextActive };
}

function settleRound(state: GameState): GameState {
  const scores = getScores(state);
  const roundWinner: Owner | 'draw' =
    scores.total.player === scores.total.ai ? 'draw' : scores.total.player > scores.total.ai ? 'player' : 'ai';
  const playerWins = state.playerWins + (roundWinner === 'player' || roundWinner === 'draw' ? 1 : 0);
  const aiWins = state.aiWins + (roundWinner === 'ai' || roundWinner === 'draw' ? 1 : 0);
  const gameDone = playerWins >= 2 || aiWins >= 2 || state.round >= 3;
  const winner = gameDone ? (playerWins === aiWins ? 'draw' : playerWins > aiWins ? 'player' : 'ai') : roundWinner;
  const message =
    roundWinner === 'draw'
      ? `第 ${state.round} 局平局，双方各得一胜点。`
      : `${nameOf(roundWinner)}赢下第 ${state.round} 局。`;
  return {
    ...state,
    phase: gameDone ? 'gameOver' : 'roundEnd',
    playerWins,
    aiWins,
    winner,
    message: gameDone ? `${message} 对局结束。` : `${message} 点击继续进入下一局。`,
  };
}

function evaluateAiCard(state: GameState, card: Card): number {
  if (card.kind === 'weather') {
    if (state.weather[card.lane]) return -4;
    const playerLane = state.board.player[card.lane].reduce((sum, item) => sum + Math.max(0, item.power - 2), 0);
    const aiLane = state.board.ai[card.lane].reduce((sum, item) => sum + Math.max(0, item.power - 2), 0);
    return playerLane - aiLane - (aiLane > playerLane ? 4 : 0);
  }
  const base = state.weather[card.lane] ? Math.min(card.power, 2) : card.power;
  const laneUnits = state.board.ai[card.lane].filter((item) => item.kind === 'unit').length;
  const bannerAlready = state.board.ai[card.lane].some((item) => item.kind === 'banner');
  const bannerBonus = card.kind === 'banner' ? laneUnits : bannerAlready && card.kind === 'unit' ? 1 : 0;
  const scoutBonus = card.kind === 'scout' && state.decks.ai.length > 0 ? 3 : 0;
  const laneNeed = Math.max(0, getScores(state).lanes.player[card.lane] - getScores(state).lanes.ai[card.lane]);
  const laneSwing = laneNeed > 0 && base + bannerBonus >= laneNeed ? 1.5 : 0;
  const conservePenalty = card.power >= 8 && getAiPressure(state) !== 'mustWin' ? 1.5 : 0;
  return base + bannerBonus + scoutBonus + laneSwing - conservePenalty;
}

function getAiPressure(state: GameState): 'ahead' | 'neutral' | 'mustWin' {
  if (state.aiWins >= 1 && state.playerWins === 0) return 'ahead';
  if (state.playerWins >= 1 && state.aiWins === 0) return 'mustWin';
  if (state.round >= 3) return 'mustWin';
  return 'neutral';
}

function hasPassed(state: GameState, owner: Owner): boolean {
  return owner === 'player' ? state.playerPassed : state.aiPassed;
}

function emptyScores(): Record<Lane, number> {
  return { front: 0, range: 0, siege: 0 };
}

function cloneBoard(state: GameState): Board {
  return {
    player: { front: [...state.board.player.front], range: [...state.board.player.range], siege: [...state.board.player.siege] },
    ai: { front: [...state.board.ai.front], range: [...state.board.ai.range], siege: [...state.board.ai.siege] },
  };
}

function cloneHands(state: GameState): Record<Owner, Card[]> {
  return { player: [...state.hands.player], ai: [...state.hands.ai] };
}

function cloneDecks(state: GameState): Record<Owner, Card[]> {
  return { player: [...state.decks.player], ai: [...state.decks.ai] };
}

function nameOf(owner: Owner): string {
  return owner === 'player' ? '你' : '电脑';
}
