// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { parseVisualExpression, VisualMathHelp } from './visual-math-help.tsx';

const item = (stem: string) => ({ subject: 'math' as const, stem });
afterEach(cleanup);

test.each([
  ['0 + 0', 'addition', 0, 0], ['10 + 10 = □', 'addition', 10, 10],
  [' 8 − 3 = ? ', 'subtraction', 8, 3], ['10 - 0', 'subtraction', 10, 0],
  ['3 × 4', 'multiplication', 3, 4], ['10 * 10', 'multiplication', 10, 10],
  ['0 × 4', 'multiplication', 0, 4], ['4 × 0', 'multiplication', 4, 0],
])('recognizes the bounded whole expression %s', (stem, operation, left, right) => {
  expect(parseVisualExpression(item(stem))).toEqual({ operation, left, right });
});

test.each([
  '11 + 1', '10 + 11', '20 - 1', '3 - 4', '11 × 2', '2 × 11',
  '-1 + 2', '+1 + 2', '01 + 2', '1.5 + 2', '1/2 + 2', '4 ÷ 2',
  '1 + 2 + 3', '(1 + 2)', '1 + 2 = 3', '□ + 2 = 3', '1 + 2 apples',
  'count 1 + 2', '1 + 2\n3', '1 + 2; alert(1)', '', '3',
])('does not invent a model for %s', (stem) => {
  expect(parseVisualExpression(item(stem))).toBeNull();
  const { container } = render(<VisualMathHelp item={item(stem)} />);
  expect(container.childElementCount).toBe(0);
});

test('does not interpret language subjects or private fields', () => {
  expect(parseVisualExpression({ subject: 'english', stem: '2 + 3' })).toBeNull();
  expect(parseVisualExpression({ subject: 'korean', stem: '2 + 3' })).toBeNull();
  const publicOnly = new Proxy(item('2 + 3'), {
    get(target, key, receiver) {
      if (key !== 'subject' && key !== 'stem') throw new Error(`Private field read: ${String(key)}`);
      return Reflect.get(target, key, receiver);
    },
  });
  render(<VisualMathHelp item={publicOnly} />);
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

test('closed large diagrams build no cells or dots until native disclosure opens', async () => {
  const { container } = render(<VisualMathHelp item={item('10 × 10')} />);
  const details = container.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(container.querySelectorAll('[data-quantity], .dm-visual-math__cell, [data-dot]')).toHaveLength(0);
  expect(container.querySelector('[role="img"]')).toBeNull();
  await toggle(details);
  expect(details.open).toBe(true);
  expect(container.querySelectorAll('[data-quantity]')).toHaveLength(10);
  expect(container.querySelectorAll('.dm-visual-math__cell')).toHaveLength(100);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(100);
  for (const group of container.querySelectorAll('[data-quantity]')) {
    expect(group.getAttribute('data-quantity')).toBe('10');
    expect(group.querySelectorAll('[data-dot]')).toHaveLength(10);
  }
  await toggle(details);
  expect(details.open).toBe(false);
  expect(container.querySelectorAll('[data-quantity], .dm-visual-math__cell, [data-dot]')).toHaveLength(0);
  await toggle(details);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(100);
});

async function reveal(stem: string) {
  const view = render(<VisualMathHelp item={item(stem)} />);
  const details = view.container.querySelector('details')!;
  expect(details.open).toBe(false);
  await toggle(details);
  expect(details.open).toBe(true);
  return view;
}

test('addition depicts two given quantities without a result numeral', async () => {
  const { container } = await reveal('3 + 4');
  const groups = container.querySelectorAll('[data-quantity]');
  expect(Array.from(groups, (group) => group.getAttribute('data-quantity'))).toEqual(['3', '4']);
  expect(Array.from(groups, (group) => group.querySelectorAll('[data-dot]').length)).toEqual([3, 4]);
  expect(container.textContent!.match(/\d+/g)).toEqual(['3', '4']);
  const image = screen.getByRole('img');
  expect(image.getAttribute('aria-label')!.match(/\d+/g)).toEqual(['3', '4']);
  expect(image.getAttribute('lang')).toBe('ko');
  expect(image.querySelector('[aria-hidden="true"]')).toBeTruthy();
});

test('subtraction crosses out the given quantity in the original set', async () => {
  const { container } = await reveal('8 - 3');
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(8);
  expect(container.querySelectorAll('[data-removed="true"]')).toHaveLength(3);
  expect(container.textContent!.match(/\d+/g)).toEqual(['8', '3']);
  expect(screen.getByRole('img').getAttribute('aria-label')!.match(/\d+/g)).toEqual(['8', '3']);
});

test.each([[3, 4], [10, 10], [0, 4], [4, 0]])('multiplication depicts %i per group and %i groups', async (per, count) => {
  const { container } = await reveal(`${per} × ${count}`);
  const groups = container.querySelectorAll('[data-quantity]');
  expect(groups).toHaveLength(count);
  for (const group of groups) expect(group.querySelectorAll('[data-dot]')).toHaveLength(per);
  expect(container.textContent!.match(/\d+/g)).toEqual([String(per), String(count)]);
  expect(screen.getByRole('img').getAttribute('aria-label')!.match(/\d+/g)).toEqual([String(per), String(count)]);
});

test.each(['0 + 0', '0 - 0'])('empty quantities render no invented dots: %s', async (stem) => {
  const { container } = await reveal(stem);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(0);
});
