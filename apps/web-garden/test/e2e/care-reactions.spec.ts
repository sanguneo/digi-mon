import { expect, test, type Page } from '@playwright/test';
import { EMPTY_GAME_STATE, careForWorld, recordAnswer, type GameState } from '../../src/game-state.ts';
import { WORLDS } from '../../src/garden-worlds.ts';
import type { Subject } from '../../src/api.ts';

async function openWorld(page: Page, subject: Subject) {
  let state: GameState = { ...EMPTY_GAME_STATE, activeSubject: subject };
  for (let i = 0; i < 3; i++) state = recordAnswer(state, 'care-test', String(i), subject).state;
  state = careForWorld(state, subject, subject === 'korean' ? 'water' : 'feed');
  await page.addInitScript((saved) => {
    if (!localStorage.getItem('digi-mon/garden-state@1')) {
      localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(saved));
    }
  }, state);
  await page.goto('/#garden');
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer', 'three-webgl');
}

async function reactToCare(page: Page, label: string) {
  const completed = page.locator('canvas').evaluate((canvas) => new Promise<{ id: number; phases: string[] }>((resolve, reject) => {
    const phases: string[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('Care response did not finish'));
    }, 15_000);
    canvas.addEventListener('garden-care-phase', (event) => {
      const detail = (event as CustomEvent<{ id: number; phase: string }>).detail;
      phases.push(detail.phase);
      if (detail.phase === 'settled') {
        clearTimeout(timeout);
        controller.abort();
        resolve({ id: detail.id, phases });
      }
    }, { signal: controller.signal });
  }));
  await page.locator('.world-care__actions').getByRole('button', { name: label, exact: true }).click();
  return completed;
}

for (const subject of ['korean', 'english', 'math'] as const) {
  for (const action of WORLDS[subject].care) {
    test(`${subject} ${action.id} has complete visible response beats without replay on reload`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await openWorld(page, subject);
      const response = await reactToCare(page, action.label);
      expect(response.phases).toEqual(['approach', 'respond', 'settle', 'settled']);
      if (subject === 'math' && action.id === 'feed') {
        const repeated = await reactToCare(page, action.label);
        expect(repeated.id).toBeGreaterThan(response.id);
        expect(repeated.phases).toEqual(response.phases);
      }
      await page.reload();
      await expect(page.locator('canvas')).toHaveAttribute('data-renderer', 'three-webgl');
      await expect(page.locator('canvas')).toHaveAttribute('data-care-id', '0');
      await expect(page.locator('canvas')).toHaveAttribute('data-care-state', 'idle');
    });
  }
}

test('reduced motion acknowledges a repeated action immediately without an animation timer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWorld(page, 'math');
  const first = await reactToCare(page, '밥 주기');
  const next = await reactToCare(page, '밥 주기');
  expect(first.phases).toEqual(['settled']);
  expect(next.phases).toEqual(['settled']);
  expect(next.id).toBeGreaterThan(first.id);
  await expect(page.locator('canvas')).toHaveAttribute('data-motion', 'off');
});
