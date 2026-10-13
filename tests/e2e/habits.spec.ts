import { expect, test, type Page } from '@playwright/test';

const TODAY = new Date('2026-10-13T12:00:00+09:00');
const TWO_DAYS_AGO = new Date('2026-10-11T12:00:00+09:00');
const HABIT_NAME = '물 한 잔 마시기';

async function registerHabit(page: Page, name = HABIT_NAME) {
  await page.getByRole('textbox', { name: '새 습관 추가' }).fill(name);
  await page.getByRole('button', { name: '습관 추가', exact: true }).click();
  await expect(page.getByRole('region', { name: '습관 상세' })
    .getByRole('heading', { name, exact: true })).toBeVisible();
}

async function registerPastHabit(page: Page) {
  // 과거 날짜도 등록일부터 수정할 수 있으므로 UI에서 그제 등록한 뒤 오늘로 이동한다.
  await page.clock.setFixedTime(TWO_DAYS_AGO);
  await page.reload();
  await registerHabit(page);
  await page.clock.setFixedTime(TODAY);
  await page.reload();
  await expect(page.getByText('2026년 10월 11일부터 시작', { exact: true })).toBeVisible();
}

async function expectStreak(page: Page, days: number) {
  const detail = page.getByRole('region', { name: '습관 상세' });
  const currentStreak = detail.locator('.streak-copy').filter({
    has: page.getByText('현재 연속 기록', { exact: true }),
  });
  await expect(currentStreak.locator('strong')).toHaveText(`${days}일`);
  await expect(page.getByRole('button', {
    name: `${HABIT_NAME} 선택, 현재 연속 ${days}일`, exact: true,
  })).toBeVisible();
}

function calendarDay(page: Page, day: number) {
  return page.getByRole('group', { name: '2026년 10월 실천 기록' })
    .getByRole('button', { name: new RegExp(`^2026년 10월 ${day}일,`) });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/');
});

test('습관 등록 후 오늘 체크와 해제에 따라 연속 일수가 1일과 0일이 된다', async ({ page }) => {
  await registerHabit(page);
  await expectStreak(page, 0);

  await page.getByRole('button', { name: '오늘 완료하기', exact: true }).click();
  await expect(calendarDay(page, 13)).toHaveAttribute('aria-pressed', 'true');
  await expectStreak(page, 1);

  await page.getByRole('button', { name: '오늘 완료 · 취소하기', exact: true }).click();
  await expect(calendarDay(page, 13)).toHaveAttribute('aria-pressed', 'false');
  await expectStreak(page, 0);
});

test('어제와 오늘을 체크하면 연속 2일이 된다', async ({ page }) => {
  await registerPastHabit(page);
  await calendarDay(page, 12).click();
  await calendarDay(page, 13).click();

  await expect(calendarDay(page, 12)).toHaveAttribute('aria-pressed', 'true');
  await expect(calendarDay(page, 13)).toHaveAttribute('aria-pressed', 'true');
  await expectStreak(page, 2);
});

test('어제를 건너뛰고 그제와 오늘만 체크하면 연속 1일이 된다', async ({ page }) => {
  await registerPastHabit(page);
  await calendarDay(page, 11).click();
  await calendarDay(page, 13).click();

  await expect(calendarDay(page, 11)).toHaveAttribute('aria-pressed', 'true');
  await expect(calendarDay(page, 12)).toHaveAttribute('aria-pressed', 'false');
  await expect(calendarDay(page, 13)).toHaveAttribute('aria-pressed', 'true');
  await expectStreak(page, 1);
});

test('새로고침 후에도 체크 기록과 연속 일수가 유지된다', async ({ page }) => {
  await registerPastHabit(page);
  await calendarDay(page, 12).click();
  await calendarDay(page, 13).click();
  await expectStreak(page, 2);

  await page.reload();

  await expect(calendarDay(page, 12)).toHaveAttribute('aria-pressed', 'true');
  await expect(calendarDay(page, 13)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '오늘 완료 · 취소하기', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expectStreak(page, 2);
});

test('삭제 확인 창을 거쳐 습관이 사라지고 다음 습관이 선택된다', async ({ page }) => {
  await registerHabit(page);
  await registerHabit(page, '책 읽기');
  await registerHabit(page, '산책하기');
  await page.getByRole('button', { name: `${HABIT_NAME} 선택, 현재 연속 0일`, exact: true }).click();

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '습관을 삭제할까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(HABIT_NAME);
  await expect(page.getByRole('button', { name: `${HABIT_NAME} 선택, 현재 연속 0일`, exact: true }))
    .toBeVisible();

  // 취소 시 유지되고, 확인했을 때에만 삭제되는지 검증한다.
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: `${HABIT_NAME} 선택, 현재 연속 0일`, exact: true }))
    .toHaveAttribute('aria-current', 'true');

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '삭제하기', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: `${HABIT_NAME} 선택, 현재 연속 0일`, exact: true }))
    .toHaveCount(0);
  await expect(page.getByRole('region', { name: /^나의 습관/ }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '책 읽기 선택, 현재 연속 0일', exact: true }))
    .toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: '습관 상세' })
    .getByRole('heading', { name: '책 읽기', exact: true })).toBeVisible();
});
