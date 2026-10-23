import { expect, test, type Page } from '@playwright/test';
import type { Habit } from '../../src/storage';

const TODAY = new Date('2026-03-18T12:00:00+09:00');

function dates(month: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
}

function habit(completedDates: string[] = [], id = 'water', name = '물 마시기'): Habit {
  return { id, name, color: 'yellow', createdAt: '2026-02-01', completedDates };
}

async function seed(page: Page, habits: Habit[]) {
  await page.evaluate((entries) => {
    localStorage.setItem('oneuldo.v1', JSON.stringify({ version: 1, habits: entries }));
  }, habits);
  await page.reload();
}

async function expectAchievement(page: Page, text: string) {
  await expect(page.getByText(`달성률 ${text}`, { exact: true })).toBeVisible();
}

function day(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^${label},`) });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/');
});

test('이번 달의 반올림, 지난달 전체 일수, 월 이동과 새로고침', async ({ page }) => {
  await seed(page, [habit([...dates('2026-03', 12), ...dates('2026-02', 20)])]);
  await expectAchievement(page, '67% (12/18일)');
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expectAchievement(page, '71% (20/28일)');
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await expectAchievement(page, '67% (12/18일)');
  await expect(page.getByRole('button', { name: '다음 달', exact: true })).toBeDisabled();
  await page.reload();
  await expectAchievement(page, '67% (12/18일)');
});

test('미완료인 오늘을 포함하고 체크와 해제 및 목록의 오늘 체크를 즉시 반영한다', async ({ page }) => {
  await seed(page, [habit()]);
  await expectAchievement(page, '0% (0/18일)');
  await day(page, '2026년 3월 1일').click();
  await expectAchievement(page, '6% (1/18일)');
  await day(page, '2026년 3월 1일').click();
  await expectAchievement(page, '0% (0/18일)');
  await page.getByRole('button', { name: '오늘 완료하기', exact: true }).click();
  await expectAchievement(page, '6% (1/18일)');
  await page.getByRole('button', { name: '물 마시기, 오늘 완료 취소', exact: true }).click();
  await expectAchievement(page, '0% (0/18일)');
  await page.getByRole('button', { name: '물 마시기, 오늘 완료하기', exact: true }).click();
  await expectAchievement(page, '6% (1/18일)');
  await page.reload();
  await expectAchievement(page, '6% (1/18일)');
});

test('월초 미체크는 분모 1이며 선택한 습관의 기록을 표시한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-03-01T12:00:00+09:00'));
  await seed(page, [habit(), habit(['2026-03-01'], 'reading', '책 읽기')]);
  await expectAchievement(page, '0% (0/1일)');
  await page.getByRole('button', { name: '책 읽기 선택, 현재 연속 1일', exact: true }).click();
  await expectAchievement(page, '100% (1/1일)');
});

test('윤년 2월 전체 완료는 100%이고 하루 미완료는 100% 미만이다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2024-03-01T12:00:00+09:00'));
  await seed(page, [{ ...habit(dates('2024-02', 29)), createdAt: '2024-02-01' }]);
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expectAchievement(page, '100% (29/29일)');
  await day(page, '2024년 2월 29일').click();
  await expectAchievement(page, '97% (28/29일)');
});

test('기존 시작일 이전 기록을 보존하고 다른 달과 미래 날짜는 달성률에서 제외한다', async ({ page }) => {
  await seed(page, [habit([...dates('2026-03', 31), '2026-02-28', '2026-04-01'])]);
  await expectAchievement(page, '100% (18/18일)');
  await expect(day(page, '2026년 3월 19일')).toBeDisabled();
  await day(page, '2026년 3월 1일').click();
  await expectAchievement(page, '94% (17/18일)');
});

for (const scenario of [
  { name: '같은 달 자정에는 분모가 증가한다', at: '2026-03-18T23:59:59+09:00', completed: ['2026-03-18'], before: '6% (1/18일)', after: '5% (1/19일)' },
  { name: '월말 자정에는 새 달로 이동한다', at: '2026-03-31T23:59:59+09:00', completed: dates('2026-03', 31), before: '100% (31/31일)', after: '0% (0/1일)' },
]) {
  test(scenario.name, async ({ page }) => {
    await page.clock.install({ time: new Date(scenario.at) });
    await seed(page, [habit(scenario.completed)]);
    await expectAchievement(page, scenario.before);
    await page.clock.runFor(1_200);
    await expectAchievement(page, scenario.after);
  });
}

test('월말 자정에도 보고 있던 과거 달은 유지한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-31T23:59:59+09:00') });
  await seed(page, [habit(dates('2026-02', 20))]);
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expectAchievement(page, '71% (20/28일)');
  await page.clock.runFor(1_200);
  await expect(page.getByRole('group', { name: '2026년 2월 실천 기록' })).toBeVisible();
  await expectAchievement(page, '71% (20/28일)');
});

test('저장 실패 시 마지막 정상 달성률과 저장 데이터를 보호한다', async ({ page }) => {
  await seed(page, [habit(dates('2026-03', 12))]);
  const saved = await page.evaluate(() => localStorage.getItem('oneuldo.v1'));
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error('저장 실패 테스트'); };
  });
  await day(page, '2026년 3월 18일').click();
  await expect(page.getByRole('alert')).toContainText('변경 내용을 저장하지 못했습니다');
  await expectAchievement(page, '67% (12/18일)');
  await expect(day(page, '2026년 3월 18일')).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('oneuldo.v1'))).toBe(saved);
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expectAchievement(page, '0% (0/28일)');
});

test('습관이 없거나 손상된 저장 데이터가 있으면 달성률을 표시하지 않는다', async ({ page }) => {
  await expect(page.locator('.monthly-achievement')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('oneuldo.v1', '손상된 데이터'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('저장된 데이터를 읽을 수 없습니다');
  await expect(page.locator('.monthly-achievement')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('oneuldo.v1'))).toBe('손상된 데이터');
});

for (const width of [1280, 320]) {
  test(`${width}px 화면에서 달성률은 월 표시 아래 한 줄로 배치된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await seed(page, [habit(dates('2026-03', 12))]);
    const label = page.locator('.monthly-achievement');
    await expectAchievement(page, '67% (12/18일)');
    const labelBox = (await label.boundingBox())!;
    const monthBox = (await page.getByText('2026년 3월', { exact: true }).boundingBox())!;
    const weekdayBox = (await page.locator('.weekday').first().boundingBox())!;
    expect(labelBox.y).toBeGreaterThanOrEqual(monthBox.y + monthBox.height);
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(weekdayBox.y);
    expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await label.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`monthly-${width}.png`), fullPage: true });
  });
}
