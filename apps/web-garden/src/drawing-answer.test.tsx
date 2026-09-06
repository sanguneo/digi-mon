// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DrawingAnswer } from './drawing-answer.tsx';
afterEach(cleanup);
test('paper confirmation is explicit and never invents an automatic grade', () => {
  const participate = vi.fn();
  const { container } = render(<DrawingAnswer name="response-1" number={1} onParticipate={participate} />);
  const value = () => container.querySelector<HTMLInputElement>('input[type="hidden"]')!.value;
  expect(value()).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '그리기 시작' }));
  expect(participate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '종이에 그렸어요' }));
  expect(value()).toBe('paper-drawing');
  expect(participate).toHaveBeenCalledTimes(1);
});
test('pointer drawing supports undo and clear without trapping scrolling by default', () => {
  const participate = vi.fn();
  const { container } = render(<DrawingAnswer name="response-2" number={2} onParticipate={participate} />);
  const area = container.querySelector('svg')!;
  Object.defineProperty(area, 'setPointerCapture', { value: vi.fn() });
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 240 } as DOMRect);
  const pointer = (kind: string, x: number, y: number) => fireEvent(area, Object.assign(new Event(kind, { bubbles: true }), { pointerId: 1, button: 0, clientX: x, clientY: y }));
  expect(area.style.touchAction).toBe('pan-y');
  pointer('pointerdown', 20, 20);
  expect(container.querySelectorAll('polyline')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '그리기 시작' }));
  pointer('pointerdown', 20, 20); pointer('pointermove', 80, 90); pointer('pointerup', 80, 90);
  expect(container.querySelector('polyline')!.getAttribute('points')).toBe('20,20 80,90');
  expect(participate).toHaveBeenCalledTimes(1);
  expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('screen-drawing');
  fireEvent.click(screen.getByRole('button', { name: '한 획 되돌리기' }));
  expect(container.querySelectorAll('polyline')).toHaveLength(0);
  expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('');
  pointer('pointerdown', 40, 40); pointer('pointerup', 40, 40);
  fireEvent.click(screen.getByRole('button', { name: '모두 지우기' }));
  expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('');
});
