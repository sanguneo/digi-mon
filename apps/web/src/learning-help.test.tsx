// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LearningHelp } from './learning-help.tsx';
import type { LearningSupport } from './api.ts';

afterEach(cleanup);

const support: LearningSupport = {
  schema: 'digi-mon/learning-support@1',
  status: 'guided-candidate',
  objective: { text: 'OBJECTIVE_TOKEN', source: 'generator-skill' },
  review: { status: 'candidate', sourceKind: 'repository-authored', revision: 1 },
  materials: [{ kind: 'principle', text: 'PRINCIPLE_TOKEN' }],
  hints: [
    { level: 1, kind: 'concept-recall', text: 'HINT_ONE_TOKEN' },
    { level: 2, kind: 'strategy', text: 'HINT_TWO_TOKEN' },
  ],
};

test('starts collapsed and reveals only delivered hints in order', () => {
  const { container } = render(<LearningHelp support={support} />);
  const details = container.querySelector('details')!;
  expect(details.open).toBe(false);
  fireEvent.click(container.querySelector('summary')!);
  expect(details.open).toBe(true);
  expect(screen.getByText(support.objective.text)).toBeTruthy();
  expect(screen.getByText(support.materials[0]!.text)).toBeTruthy();
  expect(screen.queryByText(support.hints[0].text)).toBeNull();
  expect(screen.queryByText(support.hints[1].text)).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(support.hints[0].text)).toBeTruthy();
  expect(screen.queryByText(support.hints[1].text)).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(support.hints[1].text)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('objective-only support does not invent hints and missing support renders nothing', () => {
  const { container, rerender } = render(<LearningHelp support={{
    schema: support.schema, status: 'objective-only', objective: support.objective,
  }} />);
  fireEvent.click(container.querySelector('summary')!);
  expect(screen.getByText(support.objective.text)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  rerender(<LearningHelp />);
  expect(container.childElementCount).toBe(0);
});

test('help state stays local to each question', () => {
  const { container } = render(<>
    <LearningHelp support={support} />
    <LearningHelp support={support} />
  </>);
  for (const summary of container.querySelectorAll('summary')) fireEvent.click(summary);
  fireEvent.click(screen.getAllByRole('button')[0]!);
  expect(screen.getAllByText(support.hints[0].text)).toHaveLength(1);
  expect(screen.queryByText(support.hints[1].text)).toBeNull();
});
