/**
 * 영어 공식 초등 권장 어휘 800개 안에 있는 낱말인지 판정한다.
 *
 * 별표 3 은 대표 표제어가 굴절형을 포함한다고 밝힌다
 * (data/curriculum/english-official-vocabulary.json 의
 * guidelines.representativeHeadwordCoversInflections). 그래서 표제어 그대로가 아니어도
 * 규칙 굴절(-s, -es, -ies, -ed, -ing, -er, -est)과 아래 불규칙형은 같은 낱말로 본다.
 * 파생어(-ly, -ful 따위)는 새 낱말로 보고 받지 않는다. 판정이 갈리면 막는 쪽으로 둔다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'curriculum', 'english-official-vocabulary.json',
);

/**
 * 불규칙 동사의 원형·과거형·과거분사형. 한 줄이 'bear bore born borne' 처럼 원형 뒤에 굴절형을
 * 늘어놓는다. 원형이 800개 밖이면 굴절형도 통과하지 못하므로 넉넉히 실어도 된다.
 */
const IRREGULAR_VERBS = `
be am is are was were been
have has had
do does did done
arise arose arisen
awake awoke awoken
bear bore born borne
beat beaten
become became
begin began begun
bend bent
bite bit bitten
bleed bled
blow blew blown
break broke broken
bring brought
build built
burn burnt
buy bought
catch caught
choose chose chosen
come came
deal dealt
dig dug
draw drew drawn
dream dreamt
drink drank drunk
drive drove driven
die dying
eat ate eaten
fall fell fallen
feed fed
feel felt
fight fought
find found
fly flew flown
forget forgot forgotten
forgive forgave forgiven
freeze froze frozen
get got gotten
give gave given
go went gone
grow grew grown
hang hung
hear heard
hide hid hidden
hold held
keep kept
know knew known
lay laid
lead led
learn learnt
leave left
lend lent
lie lay lain lying
light lit
lose lost
make made
mean meant
meet met
pay paid
ride rode ridden
ring rang rung
rise rose risen
run ran
say said
see saw seen
seek sought
sell sold
send sent
shake shook shaken
shine shone
shoot shot
show shown
sing sang sung
sink sank sunk
sit sat
sleep slept
slide slid
speak spoke spoken
spend spent
spell spelt
spill spilt
stand stood
steal stole stolen
stick stuck
sting stung
strike struck
swim swam swum
swing swung
take took taken
teach taught
tear tore torn
tell told
think thought
throw threw thrown
tie tying
understand understood
wake woke woken
wear wore worn
weep wept
win won
wind wound
write wrote written
`;

/** 동사 밖의 불규칙 굴절형(대명사 격, 불규칙 복수, 불규칙 비교급) -> 표제어. */
const IRREGULAR_OTHER = {
  i: 'I', me: 'I', my: 'I', mine: 'I',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse',
  geese: 'goose', people: 'person', leaves: 'leaf', knives: 'knife', wives: 'wife', lives: 'life',
  wolves: 'wolf', halves: 'half', shelves: 'shelf', thieves: 'thief',
  him: 'he', his: 'he', her: 'she', hers: 'she', us: 'we', our: 'we', ours: 'we',
  them: 'they', their: 'they', theirs: 'they', its: 'it', your: 'you', yours: 'you',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: ['many', 'much'], most: ['many', 'much'], less: 'little', least: 'little',
  farther: 'far', farthest: 'far', further: 'far', furthest: 'far', elder: 'old', eldest: 'old',
};

/** 불규칙 굴절형 -> 될 수 있는 표제어들. 'lay' 처럼 둘 이상의 원형에 걸리는 꼴이 있다. */
const IRREGULAR = new Map();
const addIrregular = (form, base) => IRREGULAR.set(form, [...(IRREGULAR.get(form) ?? []), base]);
for (const line of IRREGULAR_VERBS.trim().split('\n')) {
  const [base, ...forms] = line.split(' ');
  for (const form of forms) addIrregular(form, base);
}
for (const [form, bases] of Object.entries(IRREGULAR_OTHER)) [bases].flat().forEach((base) => addIrregular(form, base));

let cached;

/** 800개 표제어와 함께 실린 대안·관련형을 소문자 집합으로 돌려준다. */
export function officialEnglishWords() {
  if (cached) return cached;
  const data = JSON.parse(readFileSync(VOCAB_PATH, 'utf8'));
  const words = new Set();
  for (const entry of data.officialElementaryEntries) {
    for (const w of [entry.headword, ...entry.alternatives, ...entry.listedRelatedForms]) {
      words.add(String(w).toLowerCase());
    }
  }
  cached = words;
  return words;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const isConsonant = (ch) => ch !== undefined && !VOWELS.has(ch);

/**
 * 표제어 하나의 규칙 굴절형(-'s, -s/-es/-ies, -ed/-d/-ied, -ing, -er/-est/-ier/-iest).
 * 'stop' -> 'stopped' 처럼 자음-모음-자음으로 끝나면 끝 자음을 겹친 꼴도 함께 낸다.
 * 품사 정보가 없어서 'corn' -> 'corner', 'bee' -> 'beer' 처럼 꼴만 맞는 낱말은 여전히 지나간다.
 */
export function regularInflections(base) {
  const forms = new Set([`${base}'s`]);
  const last = base.at(-1);
  const consonantY = last === 'y' && isConsonant(base.at(-2));
  const yStem = base.slice(0, -1);
  const endsE = last === 'e';
  const eStem = endsE ? base.slice(0, -1) : base;
  const cvc = base.length >= 3 && isConsonant(last) && !'wxy'.includes(last)
    && VOWELS.has(base.at(-2)) && isConsonant(base.at(-3));

  forms.add(consonantY ? `${yStem}ies` : `${base}s`);
  if (/(s|x|z|ch|sh|o)$/.test(base)) forms.add(`${base}es`);
  for (const suffix of ['ed', 'er', 'est']) {
    if (consonantY) forms.add(`${yStem}i${suffix}`);
    else forms.add(`${eStem}${suffix}`);
    if (cvc) forms.add(`${base}${last}${suffix}`);
  }
  forms.add(`${endsE && !/(ee|ye|oe)$/.test(base) ? eStem : base}ing`);
  if (cvc) forms.add(`${base}${last}ing`);
  return forms;
}

/** 끝을 떼어 표제어가 될 수 있는 꼴을 모은다. 실제로 받는지는 regularInflections 로 되짚는다. */
function stems(word) {
  const out = new Set();
  for (const suffix of ["'s", 's', 'es', 'ies', 'd', 'ed', 'ied', 'ing', 'er', 'ier', 'est', 'iest']) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    if (stem.length < 2) continue;
    out.add(stem);
    out.add(`${stem}e`);
    out.add(`${stem}y`);
    if (stem.at(-1) === stem.at(-2)) out.add(stem.slice(0, -1));
  }
  return out;
}

/** word 가 800개 안 표제어의 규칙 굴절형인가. 떼어 낸 어간을 다시 굴절해 같은 꼴이 나올 때만 받는다. */
function isRegularInflectionOfOfficial(word, words) {
  for (const stem of stems(word)) {
    if (words.has(stem) && regularInflections(stem).has(word)) return true;
  }
  return false;
}

/** 낱말 하나가 800개 안의 낱말(또는 그 굴절형)인가. */
export function isOfficialEnglishWord(raw, allowedNames = []) {
  const word = raw.toLowerCase();
  const words = officialEnglishWords();
  if (allowedNames.some((n) => n.toLowerCase() === word)) return true;
  // 'left', 'found' 처럼 불규칙형이 따로 표제어이기도 하므로 규칙 후보도 함께 본다.
  if ((IRREGULAR.get(word) ?? []).some((base) => words.has(base.toLowerCase()))) return true;
  return words.has(word) || isRegularInflectionOfOfficial(word, words);
}

/** 문면에서 영어 낱말을 뽑아 800개 밖의 것만 돌려준다. */
export function englishWordsOutsideOfficial(texts, allowedNames = []) {
  const outside = new Set();
  for (const text of texts) {
    for (const token of String(text).match(/[A-Za-z]+(?:'[a-z]+)?/g) ?? []) {
      // 알파벳 한 글자(문자 인식 문항의 a, B)는 낱말이 아니다. 'I' 와 'a' 는 표제어다.
      if (token.length === 1) continue;
      if (!isOfficialEnglishWord(token, allowedNames)) outside.add(token);
    }
  }
  return [...outside];
}
