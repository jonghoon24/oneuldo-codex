export type DateKey = string;

export function localDateKey(date: Date): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: DateKey): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return date;
}

export function shiftDate(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key)!;
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function shiftMonth(monthKey: string, months: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  return localDateKey(date).slice(0, 7);
}

export function monthDays(monthKey: string): Array<DateKey | null> {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7;
  return [
    ...Array<null>(mondayOffset).fill(null),
    ...Array.from({ length: days }, (_, index) => localDateKey(new Date(year, month - 1, index + 1))),
  ];
}

export function currentStreak(completedDates: readonly DateKey[], today: DateKey): number {
  const completed = new Set(completedDates);
  let cursor = completed.has(today) ? today : shiftDate(today, -1);
  let count = 0;
  while (completed.has(cursor)) {
    count += 1;
    cursor = shiftDate(cursor, -1);
  }
  return count;
}

export function fullDateLabel(key: DateKey): string {
  const date = parseDateKey(key)!;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}년 ${month}월`;
}
