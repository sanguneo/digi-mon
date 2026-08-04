/** 문장제에 쓰는 이름·사물 어휘. 초등 저학년 수준으로 제한한다. */

export const NAMES = ['지우', '민준', '서연', '하준', '수아', '예준', '지호', '유나', '시우', '나윤', '도윤', '채원', '건우', '아린'];

/** noun: 사물, counter: 단위명사, place: 담는 곳 */
export const THINGS = [
  { noun: '구슬', counter: '개', place: '주머니' },
  { noun: '연필', counter: '자루', place: '필통' },
  { noun: '공책', counter: '권', place: '가방' },
  { noun: '색종이', counter: '장', place: '상자' },
  { noun: '딸기', counter: '개', place: '접시' },
  { noun: '사탕', counter: '개', place: '봉지' },
  { noun: '스티커', counter: '장', place: '앨범' },
  { noun: '병아리', counter: '마리', place: '우리' },
  { noun: '튤립', counter: '송이', place: '화단' },
  { noun: '블록', counter: '개', place: '바구니' },
  { noun: '단추', counter: '개', place: '통' },
  { noun: '귤', counter: '개', place: '바구니' },
];

/** 곱셈 상황용: 한 묶음에 같은 수가 들어가는 배열 맥락 */
export const GROUPINGS = [
  { unit: '접시', per: '접시마다' },
  { unit: '상자', per: '상자마다' },
  { unit: '봉지', per: '봉지마다' },
  { unit: '바구니', per: '바구니마다' },
  { unit: '줄', per: '한 줄에' },
  { unit: '묶음', per: '한 묶음에' },
];
