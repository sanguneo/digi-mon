export type GardenItemCategory = 'rest' | 'bloom' | 'waterside' | 'sky-light';

export interface GameItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: GardenItemCategory;
  readonly art: string;
}

export interface GardenCategory {
  readonly id: GardenItemCategory;
  readonly name: string;
  readonly description: string;
}

export const GARDEN_CATEGORIES: readonly GardenCategory[] = [
  { id: 'rest', name: '쉴 곳', description: '앉아서 쉬고 책을 읽는 친구들' },
  { id: 'bloom', name: '꽃과 열매', description: '정원을 향긋하고 달콤하게' },
  { id: 'waterside', name: '물가 풍경', description: '졸졸 흐르고 찰랑이는 장식' },
  { id: 'sky-light', name: '하늘과 빛', description: '바람과 빛을 담은 장식' },
];

export const GAME_CATALOG: readonly GameItem[] = [
  {
    id: 'moon-chair',
    name: '달빛 의자',
    description: '달빛 아래 쉬어 가는 의자',
    category: 'rest',
    art: '🌙',
  },
  {
    id: 'dandelion-pot',
    name: '민들레 화분',
    description: '노란 민들레가 피었어요',
    category: 'bloom',
    art: '🌼',
  },
  {
    id: 'tiny-pond',
    name: '작은 연못',
    description: '물고기가 살짝 헤엄쳐요',
    category: 'waterside',
    art: '🐟',
  },
  {
    id: 'cloud-balloon',
    name: '구름 풍선',
    description: '하늘에 둥실 떠 있어요',
    category: 'sky-light',
    art: '☁️',
  },
  {
    id: 'reading-cat',
    name: '책 읽는 고양이',
    description: '고양이가 조용히 책을 읽어요',
    category: 'rest',
    art: '🐈',
  },
  {
    id: 'rainbow-flag',
    name: '무지개 깃발',
    description: '정원 입구를 밝혀요',
    category: 'sky-light',
    art: '🌈',
  },
  {
    id: 'picnic-basket',
    name: '소풍 바구니',
    description: '잔디밭 소풍을 준비했어요',
    category: 'rest',
    art: '🧺',
  },
  {
    id: 'strawberry-patch',
    name: '딸기 텃밭',
    description: '빨간 딸기가 콕콕 열렸어요',
    category: 'bloom',
    art: '🍓',
  },
  {
    id: 'mushroom-home',
    name: '버섯 오두막',
    description: '작은 숲 친구의 포근한 집',
    category: 'bloom',
    art: '🍄',
  },
  {
    id: 'bird-bath',
    name: '새들의 물그릇',
    description: '작은 새가 물을 마시러 와요',
    category: 'waterside',
    art: '🐦',
  },
  {
    id: 'pebble-fountain',
    name: '조약돌 분수',
    description: '맑은 물이 보글보글 솟아요',
    category: 'waterside',
    art: '⛲',
  },
  {
    id: 'firefly-lantern',
    name: '반딧불 등불',
    description: '저녁 정원에 포근한 빛을 켜요',
    category: 'sky-light',
    art: '🏮',
  },
];
