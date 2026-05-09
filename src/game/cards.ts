export type Owner = 'player' | 'ai';
export type Lane = 'front' | 'range' | 'siege';
export type CardKind = 'unit' | 'weather' | 'banner' | 'scout';

export type CardDefinition = {
  id: string;
  name: string;
  lane: Lane;
  power: number;
  kind: CardKind;
  text: string;
};

export type Card = CardDefinition & {
  instanceId: string;
};

const baseDeck: CardDefinition[] = [
  { id: 'vanguard', name: '晨盾先锋', lane: 'front', power: 6, kind: 'unit', text: '坚实的近战单位。' },
  { id: 'pike', name: '长矛民兵', lane: 'front', power: 4, kind: 'unit', text: '朴素可靠。' },
  { id: 'duelist', name: '渡口决斗者', lane: 'front', power: 7, kind: 'unit', text: '高点数近战牌。' },
  { id: 'ranger', name: '林线游侠', lane: 'range', power: 5, kind: 'unit', text: '远程战线单位。' },
  { id: 'archer', name: '灰羽射手', lane: 'range', power: 6, kind: 'unit', text: '稳定输出。' },
  { id: 'sapper', name: '攻城工匠', lane: 'siege', power: 5, kind: 'unit', text: '攻城战线单位。' },
  { id: 'trebuchet', name: '旧城投石机', lane: 'siege', power: 8, kind: 'unit', text: '强力攻城牌。' },
  { id: 'drummer', name: '铜鼓号手', lane: 'front', power: 2, kind: 'banner', text: '使己方此战线所有单位 +1。' },
  { id: 'fog', name: '低地浓雾', lane: 'range', power: 0, kind: 'weather', text: '双方远程单位最多只计 2 点。' },
  { id: 'rain', name: '冷雨泥泞', lane: 'siege', power: 0, kind: 'weather', text: '双方攻城单位最多只计 2 点。' },
  { id: 'scout', name: '酒馆探子', lane: 'range', power: 1, kind: 'scout', text: '出牌后抽 1 张牌。' },
  { id: 'marshal', name: '边境统领', lane: 'front', power: 9, kind: 'unit', text: '稀有强牌。' },
];

const aiDeck: CardDefinition[] = [
  { id: 'raider', name: '盐路劫掠者', lane: 'front', power: 6, kind: 'unit', text: '凶狠的近战单位。' },
  { id: 'guard', name: '黑门守卫', lane: 'front', power: 4, kind: 'unit', text: '守住战线。' },
  { id: 'blade', name: '弯刀客', lane: 'front', power: 7, kind: 'unit', text: '高点数近战牌。' },
  { id: 'crossbow', name: '铁弩手', lane: 'range', power: 5, kind: 'unit', text: '远程战线单位。' },
  { id: 'hunter', name: '荒丘猎人', lane: 'range', power: 6, kind: 'unit', text: '稳定输出。' },
  { id: 'mason', name: '灰墙炮匠', lane: 'siege', power: 5, kind: 'unit', text: '攻城战线单位。' },
  { id: 'ballista', name: '断绳弩炮', lane: 'siege', power: 8, kind: 'unit', text: '强力攻城牌。' },
  { id: 'standard', name: '乌木旗手', lane: 'front', power: 2, kind: 'banner', text: '使己方此战线所有单位 +1。' },
  { id: 'mist', name: '沼岸白雾', lane: 'range', power: 0, kind: 'weather', text: '双方远程单位最多只计 2 点。' },
  { id: 'storm', name: '石路暴雨', lane: 'siege', power: 0, kind: 'weather', text: '双方攻城单位最多只计 2 点。' },
  { id: 'spy', name: '破帽密探', lane: 'range', power: 1, kind: 'scout', text: '出牌后抽 1 张牌。' },
  { id: 'captain', name: '鸦塔队长', lane: 'front', power: 9, kind: 'unit', text: '稀有强牌。' },
];

export const lanes: Lane[] = ['front', 'range', 'siege'];

export const laneNames: Record<Lane, string> = {
  front: '近战',
  range: '远程',
  siege: '攻城',
};

export function createDeck(owner: Owner): Card[] {
  const definitions = owner === 'player' ? baseDeck : aiDeck;
  return shuffle([...definitions, ...definitions.slice(0, 6)]).map((card, index) => ({
    ...card,
    instanceId: `${owner}-${card.id}-${index}-${Math.random().toString(16).slice(2)}`,
  }));
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
