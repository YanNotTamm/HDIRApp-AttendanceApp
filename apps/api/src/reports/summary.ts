// Pure daily-summary math for the reports module (unit-tested without DB).
//
// "Late / overtime" policy, stated plainly because there is NO per-user
// or per-office shift model in this repo (see README limitations):
// - Work hours come from env WORK_START_TIME / WORK_END_TIME (HH:MM,
//   server-local time), defaulting to 08:00–17:00.
// - late = first check-in of the day is after the work start time.
// - overtime_minutes = minutes between check-out and work end time,
//   0 when check-out is on time or missing.
// - worked_minutes = check-out minus check-in, null without a check-out.
// - Days are grouped by the UTC calendar date of the timestamps (the DB
//   stores UTC); for a server running in WIB this can shift a late-night
//   record by one day, which README documents.
export interface AttendanceRowLike {
  user_id: number;
  check_type: string;
  timestamp: Date;
  status: string;
  mode: string;
}

export interface DailyRow {
  user_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  worked_minutes: number | null;
  late: boolean;
  overtime_minutes: number;
  status: string;
  mode: string;
}

export function parseWorkTime(value: string | undefined, fallback: string): number {
  const m = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec((value ?? '').trim());
  const use = m ? m[0] : fallback;
  const [h, min] = use.split(':').map(Number);
  return h * 60 + min;
}

export function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function buildDailySummary(rows: AttendanceRowLike[], workStartMinutes: number, workEndMinutes: number): DailyRow[] {
  const byKey = new Map<string, AttendanceRowLike[]>();
  for (const row of rows) {
    const date = row.timestamp.toISOString().slice(0, 10);
    const key = `${row.user_id}|${date}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  const out: DailyRow[] = [];
  for (const [key, list] of byKey) {
    list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const checkIn = list.find((r) => r.check_type === 'in');
    const checkOut = list.find((r) => r.check_type === 'out');
    const worked =
      checkIn && checkOut
        ? Math.max(0, Math.round((checkOut.timestamp.getTime() - checkIn.timestamp.getTime()) / 60000))
        : null;
    out.push({
      user_id: Number(key.split('|')[0]),
      date: key.split('|')[1],
      check_in: checkIn ? checkIn.timestamp.toISOString() : null,
      check_out: checkOut ? checkOut.timestamp.toISOString() : null,
      worked_minutes: worked,
      late: checkIn ? minutesOfDay(checkIn.timestamp) > workStartMinutes : false,
      overtime_minutes: checkOut ? Math.max(0, minutesOfDay(checkOut.timestamp) - workEndMinutes) : 0,
      status: checkIn ? checkIn.status : 'absent',
      mode: checkIn ? checkIn.mode : 'absent',
    });
  }
  out.sort((a, b) => (a.date === b.date ? a.user_id - b.user_id : a.date < b.date ? -1 : 1));
  return out;
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: DailyRow[]): string {
  const header = ['user_id', 'date', 'check_in', 'check_out', 'worked_minutes', 'late', 'overtime_minutes', 'status', 'mode'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.user_id, r.date, r.check_in, r.check_out, r.worked_minutes, r.late, r.overtime_minutes, r.status, r.mode]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
