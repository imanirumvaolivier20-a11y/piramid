import type { AttendanceStatus, PayCycle } from "@/generated/prisma/enums";
import { toDateInput } from "@/lib/format";

// All dates here are UTC midnights, matching how @db.Date columns come back.

const DAY = 24 * 60 * 60 * 1000;
/** Fortnights are counted from this Monday, so every account's two-week periods line up. */
const BIWEEKLY_ANCHOR = Date.UTC(2026, 0, 5);

export const payCycleLabels: Record<PayCycle, string> = {
  WEEKLY: "Weekly (Monday to Sunday)",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly (calendar month)",
};

export const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
};

/** Share of the daily rate earned for each status. */
export const attendanceShare: Record<AttendanceStatus, number> = { PRESENT: 1, HALF_DAY: 0.5, ABSENT: 0 };

export type Period = { start: Date; end: Date };

export function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY);
}

/** The pay period that contains `date`. `end` is the last day, inclusive. */
export function periodFor(date: Date, cycle: PayCycle): Period {
  const day = utcDay(date);
  if (cycle === "MONTHLY") {
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
    return { start, end };
  }
  if (cycle === "BIWEEKLY") {
    const index = Math.floor((day.getTime() - BIWEEKLY_ANCHOR) / (14 * DAY));
    const start = new Date(BIWEEKLY_ANCHOR + index * 14 * DAY);
    return { start, end: addDays(start, 13) };
  }
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  const start = addDays(day, -sinceMonday);
  return { start, end: addDays(start, 6) };
}

export function previousPeriod(period: Period, cycle: PayCycle) {
  return periodFor(addDays(period.start, -1), cycle);
}

export function nextPeriod(period: Period, cycle: PayCycle) {
  return periodFor(addDays(period.end, 1), cycle);
}

export function inPeriod(date: Date, period: Period) {
  return date >= period.start && date <= period.end;
}

export function periodLabel(period: Period) {
  const format = (date: Date, withYear: boolean) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(date);
  return `${format(period.start, false)} – ${format(period.end, true)}`;
}

/** Period key used in URLs: the first day as YYYY-MM-DD. */
export function periodKey(period: Period) {
  return toDateInput(period.start);
}

/** The daily rate a worker is paid: their own rate, else their category's. */
export function dailyRateOf(worker: {
  dailyRate: { toString(): string } | null;
  category: { dailyRate: { toString(): string } | null } | null;
}) {
  const rate = worker.dailyRate ?? worker.category?.dailyRate ?? null;
  return rate === null ? null : Number(rate);
}

/**
 * Wages for a project, without counting a day twice: where attendance was
 * recorded for an account on a date, it replaces the wage lines of that
 * account's daily reports for the same date.
 */
export function projectWages(
  reportWages: { amount: { toString(): string }; report: { accountId: string; date: Date } }[],
  attendance: { amount: { toString(): string }; accountId: string; date: Date }[],
) {
  const covered = new Set(attendance.map((a) => `${a.accountId}|${a.date.getTime()}`));
  const fromReports = reportWages
    .filter((w) => !covered.has(`${w.report.accountId}|${w.report.date.getTime()}`))
    .reduce((sum, w) => sum + Number(w.amount), 0);
  const fromAttendance = attendance.reduce((sum, a) => sum + Number(a.amount), 0);
  return { fromReports, fromAttendance, total: fromReports + fromAttendance };
}

type LedgerAttendance = {
  id: string;
  date: Date;
  status: AttendanceStatus;
  amount: { toString(): string };
  project: { name: string };
};
type LedgerPayment = { id: string; date: Date; amount: { toString(): string }; note: string | null };

/**
 * A worker's pay history grouped into pay periods, newest first, with the
 * balance owed at the end of each period.
 */
export function buildLedger(attendance: LedgerAttendance[], payments: LedgerPayment[], cycle: PayCycle) {
  const periods = new Map<number, { period: Period; attendance: LedgerAttendance[]; payments: LedgerPayment[] }>();
  const bucket = (date: Date) => {
    const period = periodFor(date, cycle);
    const key = period.start.getTime();
    if (!periods.has(key)) periods.set(key, { period, attendance: [], payments: [] });
    return periods.get(key)!;
  };
  attendance.forEach((a) => bucket(a.date).attendance.push(a));
  payments.forEach((p) => bucket(p.date).payments.push(p));

  let balance = 0;
  const ordered = [...periods.values()]
    .sort((a, b) => a.period.start.getTime() - b.period.start.getTime())
    .map((entry) => {
      const earned = entry.attendance.reduce((sum, a) => sum + Number(a.amount), 0);
      const paid = entry.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const days = entry.attendance.reduce((sum, a) => sum + attendanceShare[a.status], 0);
      balance += earned - paid;
      return {
        ...entry,
        attendance: entry.attendance.sort((a, b) => b.date.getTime() - a.date.getTime()),
        payments: entry.payments.sort((a, b) => b.date.getTime() - a.date.getTime()),
        earned,
        paid,
        days,
        balance,
      };
    });
  return { periods: ordered.reverse(), owed: balance };
}
