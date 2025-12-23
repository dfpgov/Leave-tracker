import { format } from "date-fns";

export function parseDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  return new Date(value);
}

export function safeFormat(value: any, formatStr: string): string {
  try {
    const date = parseDate(value);
    if (isNaN(date.getTime())) return 'Invalid date';
    return format(date, formatStr);
  } catch {
    return 'Invalid date';
  }
}
