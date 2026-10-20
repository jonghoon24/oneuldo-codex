import { fullDateLabel, localDateKey, parseDateKey, type DateKey } from './dates';
import { createDemoData } from './demoData';

export type Habit = {
  id: string;
  name: string;
  /** 습관 시작일. 저장 형식 호환을 위해 기존 필드명을 유지한다. */
  createdAt: DateKey;
  completedDates: DateKey[];
};

export type SavedData = { version: 1; habits: Habit[] };

const STORAGE_KEY = 'oneuldo.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidName(name: unknown): name is string {
  return typeof name === 'string' &&
    name === name.trim() &&
    !/[\r\n\u2028\u2029]/.test(name) &&
    Array.from(name).length >= 1 &&
    Array.from(name).length <= 20;
}

function parseSavedData(raw: string): SavedData {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.habits)) {
    throw new Error('저장된 데이터 형식이 올바르지 않습니다.');
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const habits: Habit[] = data.habits.map((item: unknown) => {
    if (!isRecord(item) ||
      typeof item.id !== 'string' || item.id.length === 0 ||
      !isValidName(item.name) ||
      typeof item.createdAt !== 'string' || !parseDateKey(item.createdAt) ||
      !Array.isArray(item.completedDates)
    ) {
      throw new Error('저장된 습관 데이터가 손상되었습니다.');
    }
    const createdAt = item.createdAt as DateKey;
    const completedDates = item.completedDates as unknown[];
    if (completedDates.some((date) =>
      typeof date !== 'string' || !parseDateKey(date))
    ) {
      throw new Error('저장된 습관 데이터가 손상되었습니다.');
    }
    if (ids.has(item.id) || names.has(item.name)) {
      throw new Error('저장된 습관 데이터가 중복되었습니다.');
    }
    if (new Set(completedDates).size !== completedDates.length) {
      throw new Error('저장된 날짜 데이터가 중복되었습니다.');
    }
    ids.add(item.id);
    names.add(item.name);
    return {
      id: item.id,
      name: item.name,
      createdAt: (completedDates as DateKey[]).reduce((earliest, date) => date < earliest ? date : earliest, createdAt),
      completedDates: completedDates as DateKey[],
    };
  });
  return { version: 1, habits };
}

export function loadData(): SavedData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== null) return parseSavedData(raw);
  if (import.meta.env.DEV) {
    const demo = createDemoData(localDateKey(new Date()));
    saveData(demo);
    return demo;
  }
  return { version: 1, habits: [] };
}

export function saveData(data: SavedData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function validateName(input: string, habits: readonly Habit[], excludingId?: string): string | null {
  if (/[\r\n\u2028\u2029]/.test(input)) return '줄바꿈 없이 이름을 입력해 주세요.';
  const name = input.trim();
  const length = Array.from(name).length;
  if (length === 0) return '습관 이름을 입력해 주세요.';
  if (length > 20) return '습관 이름은 20자 이하로 입력해 주세요.';
  if (habits.some((habit) => habit.id !== excludingId && habit.name === name)) {
    return '이미 같은 이름의 습관이 있습니다.';
  }
  return null;
}

export function validateStartDate(input: string, today: DateKey, completedDates: readonly DateKey[] = []): string | null {
  if (!input) return '시작일을 입력해 주세요.';
  if (!parseDateKey(input)) return '올바른 날짜를 입력해 주세요.';
  if (input < '1900-01-01') return '시작일은 1900년 1월 1일 이후로 입력해 주세요.';
  if (input > today) return '시작일은 오늘 이후로 지정할 수 없습니다.';
  const earliest = completedDates.reduce<string | null>((first, date) => first === null || date < first ? date : first, null);
  if (earliest && input > earliest) return `가장 이른 기록인 ${fullDateLabel(earliest)} 이후로 시작일을 지정할 수 없습니다.`;
  return null;
}
