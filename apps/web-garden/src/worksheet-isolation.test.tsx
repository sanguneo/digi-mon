// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Worksheet } from './api.ts';
import { GameProvider } from './game-context.tsx';
import { collectResponses, WorksheetItems } from './worksheet-items.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function sheet(fingerprint: string): Worksheet {
  return {
    schema: 'digi-mon/worksheet@5', fingerprint, seed: fingerprint, title: 'fixture',
    requested: 1, produced: 1, shortfall: 0,
    options: { subject: 'math', count: 1, modes: [], followLearningOrder: false, excludeItemIds: [] },
    standardsUsed: ['[2수01-03]'], difficultyHistogram: { 1: 1 },
    items: [{
      id: 'same-item', number: 1, subject: 'math', subjectKorean: '수학',
      standardCode: '[2수01-03]', gradeBand: '1-2', domain: '수와 연산',
      skill: 'fixture', difficulty: 1, format: 'multiple-choice', scoring: 'auto',
      stem: 'fixture', choices: [{ label: 'A', text: 'FIRST' }, { label: 'B', text: 'SECOND' }],
    }],
  };
}

test('two mounted worksheet instances retain their own radio selection even for identical items', () => {
  const worksheet = sheet('same-fingerprint');
  const { container } = render(<GameProvider>
    <WorksheetItems worksheet={worksheet} diagnostic />
    <WorksheetItems worksheet={worksheet} diagnostic={false} />
  </GameProvider>);
  const fields = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  fireEvent.click(fields[0]!);
  fireEvent.click(fields[3]!);
  expect(fields[0]!.checked).toBe(true);
  expect(fields[3]!.checked).toBe(true);
  expect(fields[0]!.name).not.toBe(fields[3]!.name);
});

test('grading collects the requested diagnostic rather than overlapping follow-up numbers', () => {
  const { container } = render(<GameProvider>
    <WorksheetItems worksheet={sheet('original')} diagnostic />
    <WorksheetItems worksheet={sheet('follow-up')} diagnostic={false} />
  </GameProvider>);
  const fields = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  fireEvent.click(fields[0]!);
  fireEvent.click(fields[3]!);
  expect(collectResponses(container, 'original')).toEqual({ 1: 'FIRST' });
});
