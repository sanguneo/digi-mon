import type { Subject } from './api.ts';
import { GAME_CATALOG, type GameItem } from './garden-catalog.ts';

export const WORLD_SUBJECTS = ['korean', 'english', 'math'] as const;
export type CareAction = 'water' | 'sunlight' | 'feed' | 'play' | 'brush';

export interface WorldDefinition {
  subjectName: string;
  name: string;
  companion: string;
  description: string;
  art: string;
  stages: readonly [string, string, string, string];
  care: readonly { id: CareAction; label: string; response: string; art: string; unlockStage?: 1 }[];
  spotLabels: readonly string[];
}

export const WORLDS: Record<Subject, WorldDefinition> = {
  korean: {
    subjectName: '국어', name: '나만의 정원', companion: '초록이', art: '🌱',
    description: '이야기 한 줄, 초록 잎 하나. 나무와 꽃을 함께 길러요.',
    stages: ['작은 새싹', '잎이 펼쳐진 나무', '꽃이 피는 나무', '열매가 맺힌 나무'],
    care: [
      { id: 'water', label: '물 주기', response: '뿌리에 물이 촉촉하게 닿았어요.', art: '💧' },
      { id: 'sunlight', label: '햇볕 쬐기', response: '잎이 따뜻한 햇볕을 향해 펼쳐졌어요.', art: '☀️' },
    ],
    spotLabels: ['큰 나무 아래', '연못 옆', '꽃길 옆', '언덕 위', '소풍 잔디밭', '작은 문 앞', '시냇물 다리', '앞뜰'],
  },
  english: {
    subjectName: '영어', name: '나만의 수족관', companion: '방울이', art: '🐠',
    description: '새로운 말을 만날 때마다, 물속 세상도 넓어져요.',
    stages: ['작은 물고기', '자라는 물고기', '반짝이는 지느러미', '든든한 물속 친구'],
    care: [
      { id: 'feed', label: '먹이 주기', response: '방울이가 먹이를 찾아 반갑게 다가왔어요.', art: '🫧' },
      { id: 'play', label: '거품 놀이', response: '동그란 거품 사이로 함께 헤엄쳤어요.', art: '🫧' },
    ],
    spotLabels: ['왼쪽 모래밭', '오른쪽 모래밭', '가운데 모래밭', '뒤쪽 물풀', '왼쪽 앞자리', '오른쪽 뒤자리', '가운데 앞자리', '오른쪽 앞자리'],
  },
  math: {
    subjectName: '수학', name: '나만의 강아지 마당', companion: '몽이', art: '🐶',
    description: '하나씩 생각하는 동안, 몽이와 추억이 차곡차곡 쌓여요.',
    stages: ['작은 아기 강아지', '자라는 강아지', '씩씩한 강아지', '든든한 단짝'],
    care: [
      { id: 'feed', label: '밥 주기', response: '몽이가 맛있게 먹고 꼬리를 흔들어요.', art: '🥣' },
      { id: 'brush', label: '빗질하기', response: '몽이의 털이 보송보송해졌어요.', art: '🪮' },
      { id: 'play', label: '공 던져 주기', response: '몽이가 통통 공을 따라 달려가요!', art: '🎾', unlockStage: 1 },
    ],
    spotLabels: ['나무 그늘', '물그릇 옆', '놀이 길', '울타리 뒤쪽', '왼쪽 잔디밭', '집 옆', '앞쪽 놀이 자리', '오른쪽 잔디밭'],
  },
};

export const WORLD_CATALOGS: Record<Subject, readonly GameItem[]> = {
  korean: GAME_CATALOG,
  english: [
    { id: 'shell-arch', name: '조개 쉼터', description: '진주빛 조개에서 쉬어요', category: 'rest', art: '🐚' },
    { id: 'ribbon-kelp', name: '리본 물풀', description: '초록 리본 같은 물풀', category: 'bloom', art: '🌿' },
    { id: 'coral-garden', name: '산호 정원', description: '산호 사이로 숨바꼭질', category: 'bloom', art: '🪸' },
    { id: 'bubble-rock', name: '거품 바위', description: '동그란 거품이 올라와요', category: 'waterside', art: '🫧' },
    { id: 'treasure-chest', name: '보물 상자', description: '반짝이는 물속 보물', category: 'rest', art: '🎁' },
    { id: 'star-lamp', name: '불가사리 등불', description: '물속을 비추는 작은 별', category: 'sky-light', art: '⭐' },
  ],
  math: [
    { id: 'puppy-ball', name: '통통 공', description: '몽이가 좋아하는 동그란 공', category: 'rest', art: '🎾' },
    { id: 'soft-bed', name: '폭신 방석', description: '동그랗게 기대어 쉬어요', category: 'rest', art: '🧺' },
    { id: 'puppy-house', name: '몽이의 집', description: '비 오는 날에도 포근하게', category: 'bloom', art: '🏠' },
    { id: 'flower-hoop', name: '꽃 놀이 고리', description: '꽃 고리 사이로 폴짝', category: 'bloom', art: '🌸' },
    { id: 'water-bowl', name: '하늘 물그릇', description: '시원한 물 한 모금', category: 'waterside', art: '🥣' },
    { id: 'paw-flag', name: '발바닥 깃발', description: '우리 마당의 작은 표시', category: 'sky-light', art: '🐾' },
  ],
};
