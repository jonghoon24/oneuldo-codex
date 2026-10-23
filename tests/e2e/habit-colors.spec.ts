import { expect, test, type Page, type Locator } from '@playwright/test';

const names = ['노랑', '분홍', '초록', '하늘', '주황', '보라'];
const ids = ['yellow', 'pink', 'green', 'sky', 'orange', 'purple'];
const rgb = ['rgb(247, 231, 121)', 'rgb(246, 174, 203)', 'rgb(185, 232, 156)', 'rgb(166, 221, 244)', 'rgb(255, 194, 139)', 'rgb(211, 181, 238)'];
const raw = (page: Page) => page.evaluate(() => localStorage.getItem('oneuldo.v1'));
const day = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^2026년 3월 ${n}일,`) });
const edit = (page: Page) => page.getByRole('button', { name: '수정', exact: true }).click();
const save = (page: Page) => page.getByRole('button', { name: '저장', exact: true }).click();
const swatch = (form: Locator, name: string) => form.getByRole('button', { name, exact: true });
const habit = (i: number, color?: unknown) => ({ id: `h${i}`, name: `습관 ${i}`, createdAt: '2026-03-01', completedDates: ['2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18'], ...(color === undefined ? {} : { color }) });
async function seed(page: Page, habits: ReturnType<typeof habit>[]) {
  await page.evaluate((habits) => localStorage.setItem('oneuldo.v1', JSON.stringify({ version: 1, habits })), habits);
  await page.reload();
}
async function openAdd(page: Page) {
  await page.getByRole('button', { name: '습관 등록', exact: true }).click();
  return page.locator('#register-habit-form');
}
async function expectPalette(form: Locator, selected: string) {
  const buttons = form.locator('.color-swatch');
  await expect(buttons).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await expect(buttons.nth(i)).toHaveAccessibleName(names[i]);
    await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', String(names[i] === selected));
    await expect(buttons.nth(i)).toHaveCSS('background-color', rgb[i]);
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-03-18T12:00:00+09:00'));
  await page.goto('/');
});

test('등록·체크·색만 수정·중복색·선택 전환·새로고침에서 화면과 기록을 보존한다', async ({ page }) => {
  const form = await openAdd(page);
  await expectPalette(form, '노랑');
  await swatch(form, '하늘').click();
  await expectPalette(form, '하늘');
  await page.getByLabel('새 습관 추가', { exact: true }).fill('물 마시기');
  await page.getByLabel('시작일', { exact: true }).fill('2026-03-01');
  await form.getByRole('button', { name: '등록', exact: true }).click();
  const check = page.locator('.list-check').first();
  await expect(check).toHaveCSS('border-top-color', rgb[3]);
  await check.click();
  await day(page, 17).click();
  await expect(check).toHaveCSS('background-color', rgb[3]);
  await expect(day(page, 17)).toHaveCSS('background-color', rgb[3]);
  const original = JSON.parse((await raw(page))!).habits[0];
  await edit(page);
  const editForm = page.locator('.detail-panel form');
  await expectPalette(editForm, '하늘');
  await swatch(editForm, '보라').click();
  await save(page);
  await expect(check).toHaveCSS('background-color', rgb[5]);
  await expect(day(page, 17)).toHaveCSS('background-color', rgb[5]);
  await expect(page.locator('.streak-copy strong')).toHaveText('2일');
  expect(JSON.parse((await raw(page))!).habits[0]).toEqual({ ...original, color: 'purple' });
  const addForm = await openAdd(page);
  await swatch(addForm, '보라').click();
  await page.getByLabel('새 습관 추가', { exact: true }).fill('책 읽기');
  await addForm.getByRole('button', { name: '등록', exact: true }).click();
  await page.locator('.list-check').nth(1).click();
  await edit(page);
  await swatch(page.locator('.detail-panel form'), '분홍').click();
  await save(page);
  await page.reload();
  await expect(page.locator('.list-check').nth(0)).toHaveCSS('background-color', rgb[5]);
  await expect(page.locator('.list-check').nth(1)).toHaveCSS('background-color', rgb[1]);
  await expect(day(page, 18)).toHaveCSS('background-color', rgb[5]);
  await page.getByRole('button', { name: /^책 읽기 선택/ }).click();
  await expect(day(page, 18)).toHaveCSS('background-color', rgb[1]);
  await edit(page);
  await swatch(page.locator('.detail-panel form'), '보라').click();
  await save(page);
  expect(JSON.parse((await raw(page))!).habits.map((h: { color: string }) => h.color)).toEqual(['purple', 'purple']);
});

test('미사용 첫 색과 최소 사용 첫 색을 폼을 열 때마다 고른다', async ({ page }) => {
  for (const colors of [[], ['yellow', 'pink'], ids, ['yellow', ...ids], ['yellow', 'pink', ...ids]]) {
    await seed(page, colors.map((color, i) => habit(i, color)));
    const form = await openAdd(page);
    const expected = colors.length === 0 ? '노랑' : colors.length === 2 || colors.length === 8 ? '초록' : colors.length === 7 ? '분홍' : '노랑';
    await expectPalette(form, expected);
    await swatch(form, '보라').click();
    await form.getByRole('button', { name: '취소', exact: true }).click();
    await expectPalette(await openAdd(page), expected);
  }
});

test('이름·시작일 검증 오류와 취소는 색을 저장하거나 화면에 적용하지 않는다', async ({ page }) => {
  await seed(page, [habit(0, 'yellow')]);
  const before = await raw(page);
  await edit(page);
  const form = page.locator('.detail-panel form');
  await swatch(form, '초록').click();
  await page.getByLabel('습관 이름 변경').fill('');
  await save(page);
  await expect(page.locator('#edit-habit-error')).toBeVisible();
  expect(await raw(page)).toBe(before);
  await page.getByLabel('습관 이름 변경').fill('습관 0');
  await page.getByLabel('시작일', { exact: true }).fill('2026-03-15');
  await save(page);
  await expect(page.locator('#edit-start-error')).toBeVisible();
  await expect(page.locator('.list-check')).toHaveCSS('background-color', rgb[0]);
  await expect(day(page, 18)).toHaveCSS('background-color', rgb[0]);
  expect(await raw(page)).toBe(before);
  await form.getByRole('button', { name: '취소', exact: true }).click();
  await edit(page);
  await expectPalette(form, '노랑');
  await swatch(form, '분홍').click();
  await form.getByRole('button', { name: '취소', exact: true }).click();
  expect(await raw(page)).toBe(before);
  await expect(day(page, 18)).toHaveCSS('background-color', rgb[0]);
});

test('기존 데이터는 등록순으로 순환 배정하고 읽기로 저장하지 않으며 다음 변경에 색을 저장한다', async ({ page }) => {
  const habits = Array.from({ length: 8 }, (_, i) => habit(i));
  await seed(page, habits);
  const before = await raw(page);
  for (let i = 0; i < 8; i++) await expect(page.locator('.list-check').nth(i)).toHaveCSS('background-color', rgb[i % 6]);
  await edit(page);
  await save(page);
  expect(await raw(page)).toBe(before);
  await day(page, 18).click();
  const saved = JSON.parse((await raw(page))!).habits;
  expect(saved.map((h: { color: string }) => h.color)).toEqual([...ids, 'yellow', 'pink']);
  expect(saved[0].completedDates).toEqual(habits[0].completedDates.filter((date) => date !== '2026-03-18'));
  expect(saved.slice(1).map((h: { completedDates: string[] }) => h.completedDates)).toEqual(habits.slice(1).map((h) => h.completedDates));
});

test('달력은 같은 주만 연결하고 미완료와 주 경계에서 끊으며 완료 외 표시 색을 유지한다', async ({ page }) => {
  await seed(page, [habit(0, 'green')]);
  await expect(day(page, 14)).toHaveClass(/connected-next/);
  await expect(day(page, 15)).not.toHaveClass(/connected-next/);
  await expect(day(page, 16)).toHaveClass(/connected-next/);
  await expect(day(page, 17)).toHaveClass(/connected-next/);
  const connector = () => day(page, 16).evaluate((el) => ({ color: getComputedStyle(el, '::after').backgroundColor, content: getComputedStyle(el, '::after').content, width: parseFloat(getComputedStyle(el, '::after').width) }));
  expect(await connector()).toMatchObject({ color: rgb[2], content: '""' });
  expect((await connector()).width).toBeGreaterThan(0);
  const before = await page.locator('.today-button, .start-marker, .legend-today, .calendar-day.today, .calendar-day:disabled').evaluateAll((els) => els.map((el) => ({ background: el.classList.contains('completed') ? null : getComputedStyle(el).backgroundColor, outline: getComputedStyle(el).outlineColor, color: el.classList.contains('completed') ? null : getComputedStyle(el).color })));
  await edit(page);
  await swatch(page.locator('.detail-panel form'), '주황').click();
  await save(page);
  expect((await connector()).color).toBe(rgb[4]);
  expect(await page.locator('.today-button, .start-marker, .legend-today, .calendar-day.today, .calendar-day:disabled').evaluateAll((els) => els.map((el) => ({ background: el.classList.contains('completed') ? null : getComputedStyle(el).backgroundColor, outline: getComputedStyle(el).outlineColor, color: el.classList.contains('completed') ? null : getComputedStyle(el).color })))).toEqual(before);
  await day(page, 17).click();
  await expect(day(page, 16)).not.toHaveClass(/connected-next/);
  await expect(day(page, 18)).not.toHaveClass(/connected-next/);
});

for (const color of ['red', null, 42]) {
  test(`잘못된 색 ${color}은 한국어 오류와 편집 차단으로 원문을 보호한다`, async ({ page }) => {
    await seed(page, [habit(0, 'yellow'), habit(1, color)]);
    const before = await raw(page);
    await expect(page.getByRole('alert')).toContainText('저장된 데이터를 읽을 수 없습니다');
    await expect(page.getByRole('button', { name: '습관 등록', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '첫 습관 등록하기' })).toBeDisabled();
    await expect(page.locator('.list-check, .detail-actions button, .calendar-day')).toHaveCount(0);
    expect(await raw(page)).toBe(before);
  });
}

test('색 저장 실패는 이전 색과 원문을 유지하고 추가·수정·삭제·체크를 막는다', async ({ page }) => {
  await seed(page, [habit(0, 'pink')]);
  const before = await raw(page);
  await edit(page);
  await swatch(page.locator('.detail-panel form'), '초록').click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('쓰기 실패'); }; });
  await save(page);
  await expect(page.getByRole('alert')).toContainText('변경 내용을 저장하지 못했습니다');
  await expect(page.locator('.list-check')).toHaveCSS('background-color', rgb[1]);
  await expect(day(page, 18)).toHaveCSS('background-color', rgb[1]);
  for (const button of await page.locator('.register-button, .detail-actions button, .list-check, .calendar-day, .today-button').all()) await expect(button).toBeDisabled();
  expect(await raw(page)).toBe(before);
});
