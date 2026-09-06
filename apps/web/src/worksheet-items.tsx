import { useId } from 'react';
import type { Worksheet, WorksheetItem } from './api.ts';
import { Figure } from './figure.tsx';
import { DrawingAnswer } from './drawing-answer.tsx';
import { LearningHelp } from './learning-help.tsx';
import { SUBJECT_PRACTICE } from './worksheet-experience.tsx';

export function isCompactCalculation(item: Pick<WorksheetItem, 'subject' | 'stem' | 'figure' | 'instruction'>): boolean {
  return item.subject === 'math' && !item.figure && !/규칙|순서|읽|자리|뛰어/.test(item.instruction ?? '')
    && /[\d□)]\s*[+\-−×÷*]\s*[\d□(]/.test(item.stem)
    && /^[\d\s.,()+\-−×÷*/=□?]+$/.test(item.stem);
}

function ItemCard({ item, diagnostic }: {
  item: WorksheetItem;
  diagnostic: boolean;
}) {
  const editable = diagnostic;
  const textLanguage = (text: string) => item.subject === 'english' && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text) ? 'en' : 'ko';
  const multiline = item.subject === 'korean' || item.scoring === 'manual';
  const drawing = editable && item.subject === 'math' && item.scoring === 'manual';
  return (
    <article className={`dm-item${isCompactCalculation(item) ? ' dm-item--calculation' : ''}`} data-dm-subject={item.subject} data-response-number={diagnostic ? item.number : undefined}>
      <header className="dm-item__meta">
        <span className="dm-item__number">{String(item.number).padStart(2, '0')}</span>
        <span className="dm-badge">{item.domain}</span>
        <span className="dm-badge dm-badge--quiet">{item.standardCode}</span>
      </header>
      {item.instruction ? <p className="dm-item__instruction">{item.instruction}</p> : null}
      <p className="dm-item__stem" lang={textLanguage(item.stem)}>{item.stem}</p>
      {item.figure ? <Figure figure={item.figure} /> : null}
      {item.learningSupport ? <LearningHelp support={item.learningSupport} /> : null}
      <fieldset className="dm-answer" aria-label={`${item.number}번 답`}>
        <legend>{editable ? '내 답' : '답을 고르거나 써 보세요'}</legend>
        {drawing ? <DrawingAnswer name={`response-${item.number}`} number={item.number} /> : item.choices ? (
          <div className="dm-choice-list">
            {item.choices.map((choice) => editable ? (
              <label className="dm-choice" key={choice.label}>
                <input type="radio" name={`response-${item.number}`} value={choice.text} />
                <span>{choice.label}</span><span lang={textLanguage(choice.text)}>{choice.text}</span>
              </label>
            ) : (
              <div className="dm-choice dm-choice--paper" key={choice.label}>
                <span>{choice.label}</span><span lang={textLanguage(choice.text)}>{choice.text}</span>
              </div>
            ))}
          </div>
        ) : editable ? (
          multiline ? (
            <textarea aria-label={`${item.number}번 답 입력`} className="dm-input dm-answer__input dm-answer__writing" name={`response-${item.number}`} rows={item.subject === 'korean' ? 4 : 3} autoComplete="off" />
          ) : (
            <input aria-label={`${item.number}번 답 입력`} className="dm-input dm-answer__input" name={`response-${item.number}`} type="text" autoComplete="off" />
          )
        ) : null}
      </fieldset>
      {!item.choices && !drawing ? (
        <div className={`dm-writing-space${editable ? ' dm-writing-space--print' : ''}`} aria-hidden="true">
          <span>{SUBJECT_PRACTICE[item.subject].answerLabel}</span>
        </div>
      ) : null}
      {item.scoring === 'manual' ? <p className="dm-item__review">이 답은 선생님과 함께 살펴봐요.</p> : null}
    </article>
  );
}

export function collectResponses(root: ParentNode = document): Record<string, string> {
  const responses: Record<string, string> = {};
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name^="response-"], textarea[name^="response-"]');
  for (const field of fields) {
    if (field instanceof HTMLInputElement && field.type === 'radio' && !field.checked) continue;
    const match = /^response-(\d+)$/.exec(field.name);
    if (match && field.value.trim()) responses[match[1] ?? ''] = field.value;
  }
  return responses;
}

export function WorksheetItems({ worksheet, diagnostic }: { worksheet: Worksheet; diagnostic: boolean }) {
  const navigationId = useId();
  const practice = SUBJECT_PRACTICE[worksheet.options.subject];
  const groups = Array.from({ length: Math.ceil(worksheet.items.length / practice.chunk) }, (_, index) =>
    worksheet.items.slice(index * practice.chunk, (index + 1) * practice.chunk));
  return (
    <div className="dm-practice" data-dm-subject={worksheet.options.subject}>
      <nav className="dm-chunk-nav" id={navigationId} aria-label="문제 묶음 이동" tabIndex={-1}>
        <span>풀고 싶은 묶음으로 가요</span>
        <div>{groups.map((items, index) => <a key={items[0]!.id} href={`#${navigationId}-${index}`} onClick={(event) => {
          event.preventDefault();
          document.getElementById(`${navigationId}-${index}`)?.focus();
        }}>{items[0]!.number}–{items[items.length - 1]!.number}번</a>)}</div>
      </nav>
      {groups.map((items, index) => (
        <section className="dm-practice-group" id={`${navigationId}-${index}`} tabIndex={-1} key={items[0]!.id} aria-label={`${index + 1}번째 묶음`}>
          <header className="dm-practice-group__header">
            <h4>{practice.label} {index + 1}묶음</h4>
            <span>{items[0]!.number}–{items[items.length - 1]!.number}번 / 전체 {worksheet.produced}문항</span>
          </header>
          <div className="dm-item-list">
            {items.map((item) => <ItemCard diagnostic={diagnostic} item={item} key={`${worksheet.fingerprint}:${item.id}`} />)}
          </div>
          <a className="dm-chunk-return" href={`#${navigationId}`} onClick={(event) => {
            event.preventDefault();
            document.getElementById(navigationId)?.focus();
          }}>묶음 고르기로 돌아가기</a>
        </section>
      ))}
    </div>
  );
}
