import { shiftDate, type DateKey } from './dates';
import type { SavedData } from './storage';

function datesAgo(today: DateKey, offsets: number[]): DateKey[] {
  return offsets.map((days) => shiftDate(today, -days)).sort();
}

export function createDemoData(today: DateKey): SavedData {
  return {
    version: 1,
    habits: [
      {
        id: 'demo-water',
        name: '물 한 잔 마시기',
        createdAt: shiftDate(today, -20),
        completedDates: datesAgo(today, [0, 1, 2, 3, 4, 5, 8, 10, 11, 13, 16, 19]),
      },
      {
        id: 'demo-reading',
        name: '책 10쪽 읽기',
        createdAt: shiftDate(today, -40),
        completedDates: datesAgo(today, [1, 2, 3, 6, 7, 10, 14, 18, 22, 27, 33, 38]),
      },
      {
        id: 'demo-walk',
        name: '가볍게 산책하기',
        createdAt: shiftDate(today, -12),
        completedDates: datesAgo(today, [3, 5, 8, 11]),
      },
    ],
  };
}
