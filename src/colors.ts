export const HABIT_COLORS = [
  { id: 'yellow', name: '노랑', value: '#f7e779' },
  { id: 'pink', name: '분홍', value: '#f6aecb' },
  { id: 'green', name: '초록', value: '#b9e89c' },
  { id: 'sky', name: '하늘', value: '#a6ddf4' },
  { id: 'orange', name: '주황', value: '#ffc28b' },
  { id: 'purple', name: '보라', value: '#d3b5ee' },
] as const;

export type HabitColor = typeof HABIT_COLORS[number]['id'];

export function isHabitColor(value: unknown): value is HabitColor {
  return HABIT_COLORS.some((color) => color.id === value);
}

export function habitColorValue(id: HabitColor): string {
  return HABIT_COLORS.find((color) => color.id === id)!.value;
}

export function suggestedColor(habits: readonly { color: HabitColor }[]): HabitColor {
  const counts = HABIT_COLORS.map((color) => habits.filter((habit) => habit.color === color.id).length);
  return HABIT_COLORS[counts.indexOf(Math.min(...counts))].id;
}
