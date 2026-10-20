import { expect, test, type Page } from '@playwright/test';

const TODAY = new Date('2026-03-18T12:00:00+09:00');
const add = (page: Page) => page.getByRole('button', { name: '등록', exact: true });
const start = (page: Page) => page.getByLabel('시작일', { exact: true });
const day = (page: Page, date: string) => page.getByRole('button', { name: new RegExp(`^${date},`) });
const achievement = (page: Page, value: string) => expect(page.getByText(`달성률 ${value}`, { exact: true })).toBeVisible();
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('oneuldo.v1'));

async function register(page: Page, date?: string) {
  await page.getByRole('button', { name: '습관 등록', exact: true }).click();
  await page.getByLabel('새 습관 추가', { exact: true }).fill('물 마시기');
  if (date) {
    await start(page).fill(date);
  }
  await add(page).click();
}

async function seed(page: Page, createdAt: string, completedDates: string[]) {
  await page.evaluate(({ createdAt, completedDates }) => {
    localStorage.setItem('oneuldo.v1', JSON.stringify({ version: 1, habits: [{ id: 'water', name: '물 마시기', createdAt, completedDates }] }));
  }, { createdAt, completedDates });
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/');
});

test('기본 시작일은 오늘이고 어제와 이전 달은 비활성화되며 오늘과 시작일을 함께 표시한다', async ({ page }) => {
  await register(page);
  await achievement(page, '0% (0/1일)');
  await expect(day(page, '2026년 3월 17일')).toBeDisabled();
  await expect(day(page, '2026년 3월 18일')).toHaveAccessibleName(/오늘, 시작일/);
  await expect(day(page, '2026년 3월 18일').getByText('시작', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '이전 달' })).toBeDisabled();
  const before = await saved(page);
  // 비활성화된 날짜에 이벤트가 전달되어도 체크 로직이 저장을 막는다.
  await day(page, '2026년 3월 17일').evaluate((element) => {
    element.removeAttribute('disabled');
    (element as HTMLButtonElement).click();
  });
  expect(await saved(page)).toBe(before);
});

test('과거 시작일로 등록하고 다음 등록은 오늘로 초기화한다', async ({ page }) => {
  await register(page, '2026-03-10');
  await achievement(page, '0% (0/9일)');
  await expect(start(page)).toHaveCount(0);
  await expect(day(page, '2026년 3월 9일')).toBeDisabled();
  await day(page, '2026년 3월 10일').click();
  await achievement(page, '11% (1/9일)');
  await page.getByRole('button', { name: '습관 등록', exact: true }).click();
  await expect(page.getByLabel('새 습관 추가', { exact: true })).toHaveValue('');
  await expect(start(page)).toHaveValue('2026-03-18');
  await page.getByLabel('새 습관 추가', { exact: true }).fill('책 읽기');
  await add(page).click();
  await achievement(page, '0% (0/1일)');
  expect(JSON.parse((await saved(page))!).habits[1].createdAt).toBe('2026-03-18');
});

for (const date of ['', '2026-03-19', '1899-12-31']) {
  test(`등록과 수정에서 잘못된 시작일(${date || '빈 값'})과 이름 오류를 함께 표시한다`, async ({ page }) => {
    await page.getByRole('button', { name: '습관 등록', exact: true }).click();
    await start(page).fill(date);
    await add(page).click();
    await expect(page.locator('#new-habit-error')).toBeVisible();
    await expect(page.locator('#new-start-error')).toBeVisible();
    expect(JSON.parse((await saved(page))!).habits).toEqual([]);
    await start(page).fill('1900-01-01');
    await page.getByLabel('새 습관 추가', { exact: true }).fill('물 마시기');
    await add(page).click();
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await page.getByLabel('습관 이름 변경', { exact: true }).fill('');
    await start(page).fill(date);
    const before = await saved(page);
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.locator('#edit-habit-error')).toBeVisible();
    await expect(page.locator('#edit-start-error')).toBeVisible();
    expect(await saved(page)).toBe(before);
  });
}

test('이름과 시작일을 함께 수정하고 기록을 보존하며 월간 분모와 탐색 범위가 바뀐다', async ({ page }) => {
  await register(page, '2026-03-10');
  await day(page, '2026년 3월 12일').click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('습관 이름 변경', { exact: true }).fill('매일 물 마시기');
  await start(page).fill('2026-02-20');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await achievement(page, '6% (1/18일)');
  await page.getByRole('button', { name: '이전 달' }).click();
  await achievement(page, '0% (0/9일)');
  await expect(day(page, '2026년 2월 19일')).toBeDisabled();
  await expect(day(page, '2026년 2월 20일')).toBeEnabled();
  await day(page, '2026년 2월 20일').click();
  await achievement(page, '11% (1/9일)');
  await day(page, '2026년 2월 20일').click();
  await expect(page.getByRole('button', { name: '이전 달' })).toBeDisabled();
  // 보고 있던 달보다 시작일을 늦추면 새 시작일이 있는 달로 이동한다.
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await start(page).fill('2026-03-12');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await achievement(page, '14% (1/7일)');
  await page.reload();
  await expect(page.getByRole('heading', { name: '매일 물 마시기', exact: true })).toBeVisible();
  await expect(day(page, '2026년 3월 12일')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(start(page)).toHaveValue('2026-03-12');
});

test('가장 이른 체크보다 늦은 시작일은 이름 변경까지 차단하고 취소와 Escape는 저장하지 않는다', async ({ page }) => {
  await seed(page, '2026-03-01', ['2026-03-10', '2026-03-12']);
  const before = await saved(page);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('습관 이름 변경', { exact: true }).fill('새 이름');
  await start(page).fill('2026-03-11');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('#edit-start-error')).toContainText('2026년 3월 10일');
  expect(await saved(page)).toBe(before);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await start(page).fill('2026-02-01');
  await start(page).press('Escape');
  await expect(start(page)).toHaveCount(0);
  expect(await saved(page)).toBe(before);
});

test('기존 기록에 맞춰 시작일만 보정하고 다음 변경 때 저장하며 원래 날짜 순서도 보존한다', async ({ page }) => {
  await seed(page, '2026-03-18', ['2026-03-12', '2026-02-20', '2026-03-10']);
  const before = await saved(page);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(start(page)).toHaveValue('2026-02-20');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  expect(await saved(page)).toBe(before); // 보정 후에도 변경 없는 저장은 쓰지 않는다.
  await page.getByRole('button', { name: '이전 달' }).click();
  await expect(day(page, '2026년 2월 20일')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('습관 이름 변경', { exact: true }).fill('새 이름');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const result = JSON.parse((await saved(page))!).habits[0];
  expect(result.createdAt).toBe('2026-02-20');
  expect(result.completedDates).toEqual(['2026-03-12', '2026-02-20', '2026-03-10']);
});

test('저장 실패는 편집 폼을 닫고 마지막 정상 기록을 보호한다', async ({ page }) => {
  await register(page);
  const before = await saved(page);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await start(page).fill('2026-03-01');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('저장 실패'); }; });
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('변경 내용을 저장하지 못했습니다');
  await expect(start(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
  await achievement(page, '0% (0/1일)');
  expect(await saved(page)).toBe(before);
});

test('기기 날짜 역행 시 현재 달을 보여주고 모든 체크와 월 이동을 막는다', async ({ page }) => {
  await seed(page, '2026-03-18', ['2026-03-18']);
  const before = await saved(page);
  await page.clock.setFixedTime(new Date('2026-02-10T12:00:00+09:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('group', { name: '2026년 2월 실천 기록' })).toBeVisible();
  await achievement(page, '0% (0/0일)');
  for (const button of await page.locator('.calendar-day, .today-button, .list-check, .month-navigation button').all()) {
    await expect(button).toBeDisabled();
  }
  expect(await saved(page)).toBe(before);
  await page.reload();
  await achievement(page, '0% (0/0일)');
});

for (const width of [1280, 320]) {
  test(`${width}px에서 등록·수정 날짜 입력과 시작일 표시가 화면 안에 배치된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await register(page);
    await page.getByRole('button', { name: '습관 등록', exact: true }).click();
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await expect(page.locator('#new-start-date')).toBeVisible();
    await expect(page.locator('#edit-start-date')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`start-date-${width}.png`), fullPage: true });
  });
}

test('등록 폼은 버튼으로 열고 취소하면 입력과 오류를 버리며 다시 열 때 현재 날짜를 쓴다', async ({ page }) => {
  const name = page.getByLabel('새 습관 추가', { exact: true });
  const open = page.getByRole('button', { name: '습관 등록', exact: true });
  await expect(name).toHaveCount(0);
  await expect(start(page)).toHaveCount(0);
  const before = await saved(page);
  await open.click();
  await expect(name).toBeFocused();
  await expect(start(page)).toHaveValue('2026-03-18');
  await start(page).fill('');
  await add(page).click();
  await expect(page.locator('#new-habit-error')).toBeVisible();
  await expect(page.locator('#new-start-error')).toBeVisible();
  await name.fill('취소할 습관');
  await start(page).fill('2026-03-01');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(name).toHaveCount(0);
  expect(await saved(page)).toBe(before);
  await page.clock.setFixedTime(new Date('2026-03-19T12:00:00+09:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await open.click();
  await expect(name).toHaveValue('');
  await expect(start(page)).toHaveValue('2026-03-19');
  await expect(page.locator('.field-error')).toHaveCount(0);
  await name.fill('키보드로 등록');
  await name.press('Enter');
  await expect(name).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '키보드로 등록', exact: true })).toBeVisible();
  expect(JSON.parse((await saved(page))!).habits[0].createdAt).toBe('2026-03-19');
});

test('빈 목록의 첫 등록 버튼으로 폼을 열고 Escape로 닫을 수 있다', async ({ page }) => {
  const before = await saved(page);
  await page.getByRole('button', { name: '첫 습관 등록하기' }).click();
  await expect(start(page)).toBeVisible();
  await page.getByLabel('새 습관 추가', { exact: true }).fill('버릴 내용');
  await start(page).press('Escape');
  await expect(start(page)).toHaveCount(0);
  expect(await saved(page)).toBe(before);
  await page.getByRole('button', { name: '습관 등록', exact: true }).click();
  await expect(page.getByLabel('새 습관 추가', { exact: true })).toHaveValue('');
});

test('등록 저장 실패 시 폼을 닫고 이후 등록을 막으며 기존 습관을 유지한다', async ({ page }) => {
  await register(page);
  const before = await saved(page);
  await page.getByRole('button', { name: '습관 등록', exact: true }).click();
  await page.getByLabel('새 습관 추가', { exact: true }).fill('책 읽기');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('저장 실패'); }; });
  await add(page).click();
  await expect(page.getByRole('alert')).toContainText('변경 내용을 저장하지 못했습니다');
  await expect(page.locator('#register-habit-form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '습관 등록', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: '물 마시기', exact: true })).toBeVisible();
  expect(await saved(page)).toBe(before);
});
