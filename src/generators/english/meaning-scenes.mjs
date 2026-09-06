/**
 * 기존 3~4학년 내용 어휘로 만든 문장-뜻 짝.
 * 색, 주체, 위치 관계를 따로 바꿔 낱말 하나만 알아서는 풀 수 없게 한다.
 * contentWords는 학년 어휘 검사용이며 어휘 목록을 확장하지 않는다.
 * 오답도 완전한 문장의 뜻이고, 원문의 주체·색·위치 중 하나 이상과 어긋난다.
 */
import { josaI } from '../../engine/korean-number.mjs';

const colors = [
  { en: 'red', ko: '빨간색입니다' },
  { en: 'yellow', ko: '노란색입니다' },
];
const coloredObjects = [
  { en: 'ball', ko: '공' },
  { en: 'box', ko: '상자' },
  { en: 'pen', ko: '펜' },
];
const subjects = [
  { en: 'pen', ko: '펜' },
  { en: 'book', ko: '책' },
  { en: 'ball', ko: '공' },
];
const places = [
  { en: 'desk', ko: '책상' },
  { en: 'box', ko: '상자' },
];
const relations = [
  { en: 'on', ko: '위에' },
  { en: 'in', ko: '안에' },
];

const colorScenes = coloredObjects.flatMap((object) => colors.map((color) => ({
  kind: 'color',
  en: `The ${object.en} is ${color.en}.`,
  ko: `${object.ko}${josaI(object.ko)} ${color.ko}.`,
  contentWords: [object.en, color.en],
})));
const locationScenes = subjects.flatMap((subject) => places.flatMap((place) => relations.map((relation) => ({
  kind: 'location',
  en: `The ${subject.en} is ${relation.en} the ${place.en}.`,
  ko: `${subject.ko}${josaI(subject.ko)} ${place.ko} ${relation.ko} 있습니다.`,
  contentWords: [subject.en, place.en],
}))));
const actionScenes = [
  {
    kind: 'action', en: 'I drink water.', ko: '나는 물을 마십니다.',
    contentWords: ['water'],
    wrong: ['나는 우유를 마십니다.', '나는 물을 좋아합니다.', '나는 문을 엽니다.'],
  },
  {
    kind: 'action', en: 'Open the book.', ko: '책을 펴세요.',
    contentWords: ['open', 'book'],
    wrong: ['문을 여세요.', '책을 닫으세요.', '책을 읽으세요.'],
  },
];

export const MEANING_SCENES = [
  ...colorScenes.map((scene) => ({
    ...scene,
    wrong: colorScenes.filter((other) => other.en !== scene.en).map((other) => other.ko),
  })),
  ...locationScenes.map((scene) => ({
    ...scene,
    wrong: locationScenes.filter((other) => other.en !== scene.en).map((other) => other.ko),
  })),
  ...actionScenes,
];
