// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

async function toggle(details: HTMLDetailsElement) {
  await act(async () => {
    const toggled = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Native toggle did not fire')), 1000);
      details.addEventListener('toggle', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
    fireEvent.click(details.querySelector('summary')!);
    await toggled;
  });
}

test.each([50, 100])('%i closed item helps do not materialize diagrams', async (count) => {
  const { container } = render(<>{Array.from({ length: count }, (_, index) =>
    <LearningHelp key={index} support={support} item={{ subject: 'math', stem: '10 × 10' }} />)}</>);
  const groupsAndDots = () => container.querySelectorAll('[data-quantity], .dm-visual-math__cell, [data-dot]');
  expect(groupsAndDots()).toHaveLength(0);
  await toggle(container.querySelector<HTMLDetailsElement>('.dm-learning-help')!);
  expect(groupsAndDots()).toHaveLength(0);
  const pictures = container.querySelectorAll<HTMLDetailsElement>('.dm-visual-math');
  await toggle(pictures[0]!);
  expect(container.querySelectorAll('[data-quantity]')).toHaveLength(10);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(100);
  for (const picture of Array.from(pictures).slice(1)) {
    expect(picture.open).toBe(false);
    expect(picture.querySelector('[data-quantity]')).toBeNull();
  }
});

test('visual disclosure is optional and independent of the two hint steps', async () => {
  const { container } = render(<LearningHelp support={support} item={{ subject: 'math', stem: '3 × 4' }} />);
  const disclosures = container.querySelectorAll('details');
  expect(disclosures).toHaveLength(2);
  fireEvent.click(disclosures[0]!.querySelector('summary')!);
  expect(disclosures[1]!.open).toBe(false);
  await toggle(disclosures[1]!);
  expect(disclosures[1]!.open).toBe(true);
  expect(screen.getByRole('img')).toBeTruthy();
  expect(screen.queryByText(support.hints[0].text)).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(support.hints[0].text)).toBeTruthy();
  expect(screen.queryByText(support.hints[1].text)).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(support.hints[1].text)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('unsupported items retain server guidance without a diagram', () => {
  const { container } = render(<LearningHelp support={support} item={{ subject: 'math', stem: '12 ÷ 3' }} />);
  expect(container.querySelectorAll('details')).toHaveLength(1);
  fireEvent.click(container.querySelector('summary')!);
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText(support.materials[0]!.text)).toBeTruthy();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(support.hints[0].text)).toBeTruthy();
});

test('missing support does not create standalone guidance', () => {
  const { container } = render(<LearningHelp item={{ subject: 'math', stem: '2 + 3' }} />);
  expect(container.childElementCount).toBe(0);
});

test('visual disclosure stays local to each question', async () => {
  const { container } = render(<>
    <LearningHelp support={support} item={{ subject: 'math', stem: '2 + 3' }} />
    <LearningHelp support={support} item={{ subject: 'math', stem: '2 + 3' }} />
  </>);
  const pictures = container.querySelectorAll<HTMLDetailsElement>('.dm-visual-math');
  for (const help of container.querySelectorAll('.dm-learning-help > summary')) fireEvent.click(help);
  await toggle(pictures[0]!);
  expect(pictures[0]!.open).toBe(true);
  expect(pictures[1]!.open).toBe(false);
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
