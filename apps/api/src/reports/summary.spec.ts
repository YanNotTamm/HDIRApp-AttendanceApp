import { buildDailySummary, toCsv, parseWorkTime } from './summary';

const row = (user_id: number, check_type: string, iso: string, status = 'approved', mode = 'normal') => ({
  user_id,
  check_type,
  timestamp: new Date(iso),
  status,
  mode,
});

describe('daily summary', () => {
  it('pairs in/out, computes worked minutes, flags late and overtime', () => {
    const rows = [
      row(1, 'in', '2026-10-30T08:30:00.000Z'),
      row(1, 'out', '2026-10-30T18:15:00.000Z'),
    ];
    const [d] = buildDailySummary(rows, 8 * 60, 17 * 60);
    expect(d.worked_minutes).toBe(585);
    expect(d.late).toBe(true); // 08:30 > 08:00
    expect(d.overtime_minutes).toBe(75); // 18:15 - 17:00
  });

  it('on-time days are not late and have no overtime', () => {
    const rows = [row(1, 'in', '2026-10-30T07:50:00.000Z'), row(1, 'out', '2026-10-30T16:59:00.000Z')];
    const [d] = buildDailySummary(rows, 8 * 60, 17 * 60);
    expect(d.late).toBe(false);
    expect(d.overtime_minutes).toBe(0);
    expect(d.worked_minutes).toBe(549);
  });

  it('a day without check-out has null worked minutes and no overtime', () => {
    const [d] = buildDailySummary([row(2, 'in', '2026-10-30T08:00:00.000Z')], 8 * 60, 17 * 60);
    expect(d.worked_minutes).toBeNull();
    expect(d.overtime_minutes).toBe(0);
    expect(d.check_out).toBeNull();
  });

  it('groups per user per day and sorts', () => {
    const rows = [
      row(2, 'in', '2026-10-31T08:00:00.000Z'),
      row(1, 'in', '2026-10-30T08:00:00.000Z'),
      row(1, 'out', '2026-10-30T17:00:00.000Z'),
    ];
    const out = buildDailySummary(rows, 8 * 60, 17 * 60);
    expect(out.map((r) => `${r.user_id}@${r.date}`)).toEqual(['1@2026-10-30', '2@2026-10-31']);
  });

  it('CSV escapes commas and quotes', () => {
    const csv = toCsv([
      {
        user_id: 1,
        date: '2026-10-30',
        check_in: '2026-10-30T08:00:00.000Z',
        check_out: null,
        worked_minutes: null,
        late: false,
        overtime_minutes: 0,
        status: 'approved',
        mode: 'normal',
      },
    ]);
    expect(csv.startsWith('user_id,date,check_in,check_out,worked_minutes,late,overtime_minutes,status,mode\n')).toBe(true);
    expect(csv).toContain('1,2026-10-30,2026-10-30T08:00:00.000Z,,');
  });

  it('invalid work-time env falls back to the default', () => {
    expect(parseWorkTime('25:99', '08:00')).toBe(480);
    expect(parseWorkTime('09:30', '08:00')).toBe(570);
  });
});
