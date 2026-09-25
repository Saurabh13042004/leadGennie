import type { SendWindow } from "./types";

/**
 * Launch-time send plan (pure, deterministic given `now`).
 *
 * Every send lands on an allowed day of the campaign's send window, at the window's start hour in the campaign's
 * timezone (or "now" when launching inside today's window). No calendar day ever carries more than `dailyLimit`
 * sends from this campaign — counting every step, not just first touches. Follow-ups keep at least their wait gap
 * after the previous step; when a day is full they slide to the next allowed day with room.
 *
 * Limits across campaigns sharing a mailbox are enforced at send time by the Phase 5 engine, not here.
 */

type LocalDate = { y: number; m: number; d: number };

const DAY_MS = 86_400_000;
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), hour: Number(get("hour")), minute: Number(get("minute")), weekday: WEEKDAY[get("weekday")] ?? 0 };
}

/** The UTC instant of a local wall-clock time in `timeZone` (DST-safe: re-derives the offset at the target). */
export function zonedTimeToUtc(date: LocalDate, hour: number, timeZone: string): Date {
  const target = Date.UTC(date.y, date.m - 1, date.d, hour);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute);
    const diff = asUtc - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** Day number (days since epoch) of a local calendar date — used as a plain integer "day index". */
const dayIndex = (d: LocalDate) => Math.floor(Date.UTC(d.y, d.m - 1, d.d) / DAY_MS);
const fromDayIndex = (i: number): LocalDate => {
  const t = new Date(i * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const weekdayOf = (i: number) => new Date(i * DAY_MS).getUTCDay();

export type PlannedSend = { leadIndex: number; stepIndex: number; at: Date };

export type SchedulePlan = {
  sends: PlannedSend[];
  /** When each lead's first step goes out (index-aligned with the leads passed in). */
  firstSendAt: Date[];
  /** Last day any send is planned for. */
  lastSendAt: Date | null;
};

/**
 * @param leadCount   leads to schedule, in enrollment order (earlier leads get earlier days)
 * @param waitDays    per step: days after the PREVIOUS step (step 0's value is the delay after launch)
 */
export function planSchedule(input: { leadCount: number; waitDays: number[]; window: SendWindow; dailyLimit: number; now: Date }): SchedulePlan {
  const { window, dailyLimit, now } = input;
  const allowed = new Set(window.days);
  const today = localParts(now, window.timezone);
  const todayIdx = dayIndex(today);
  // Launching inside today's window sends today's batch now; after the window closes, day 0 is not usable.
  const todayOpen = allowed.has(today.weekday) && today.hour < window.endHour;
  const firstUsable = todayOpen ? todayIdx : todayIdx + 1;
  const used = new Map<number, number>();

  const slotAt = (minDay: number) => {
    let day = Math.max(minDay, firstUsable);
    for (let guard = 0; guard < 3660; guard++, day++) {
      if (!allowed.has(weekdayOf(day))) continue;
      if ((used.get(day) ?? 0) >= dailyLimit) continue;
      used.set(day, (used.get(day) ?? 0) + 1);
      return day;
    }
    throw new Error("Could not fit the schedule in the next 10 years — check the send window.");
  };

  const instantFor = (day: number) => {
    const start = zonedTimeToUtc(fromDayIndex(day), window.startHour, window.timezone);
    // Today, inside the window: now (never in the past).
    return day === todayIdx && start.getTime() < now.getTime() ? new Date(now.getTime()) : start;
  };

  const sends: PlannedSend[] = [];
  const firstSendAt: Date[] = [];
  let lastDay: number | null = null;
  // Step-major order: every lead's first touch is placed before any follow-up claims capacity, so first touches
  // go out as early as the limit allows and follow-ups fill in behind them.
  const leadDays: number[] = new Array(input.leadCount).fill(todayIdx);
  input.waitDays.forEach((wait, s) => {
    for (let i = 0; i < input.leadCount; i++) {
      const day = slotAt(leadDays[i] + Math.max(0, wait));
      leadDays[i] = day;
      const at = instantFor(day);
      sends.push({ leadIndex: i, stepIndex: s, at });
      if (s === 0) firstSendAt[i] = at;
      if (lastDay === null || day > lastDay) lastDay = day;
    }
  });
  return { sends, firstSendAt, lastSendAt: lastDay === null ? null : instantFor(lastDay) };
}

// ---- send-time helpers (used by the SendGate, which decides at the moment of sending) ---------------------------------

/** Start (00:00) of the local calendar day containing `now`, as a UTC instant. Used for "today's" send counts. */
export function localDayStart(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return zonedTimeToUtc({ y: p.y, m: p.m, d: p.d }, 0, timeZone);
}

/** Start of the NEXT local day — when a daily limit resets. */
export function nextLocalDayStart(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return zonedTimeToUtc(fromDayIndex(dayIndex({ y: p.y, m: p.m, d: p.d }) + 1), 0, timeZone);
}

/** Is `now` inside the send window (allowed weekday AND start ≤ hour < end, in the window's timezone)? */
export function isWindowOpen(now: Date, window: SendWindow): boolean {
  const p = localParts(now, window.timezone);
  return window.days.includes(p.weekday) && p.hour >= window.startHour && p.hour < window.endHour;
}

/** The next instant the window opens (after `now`; `now` itself when it is already open). */
export function nextWindowOpen(now: Date, window: SendWindow): Date {
  if (isWindowOpen(now, window)) return now;
  const p = localParts(now, window.timezone);
  const today = dayIndex({ y: p.y, m: p.m, d: p.d });
  // Later today, if today is an allowed day and the window hasn't opened yet.
  if (window.days.includes(p.weekday) && p.hour < window.startHour) return zonedTimeToUtc(fromDayIndex(today), window.startHour, window.timezone);
  for (let i = 1; i <= 8; i++) {
    if (window.days.includes(weekdayOf(today + i))) return zonedTimeToUtc(fromDayIndex(today + i), window.startHour, window.timezone);
  }
  return new Date(now.getTime() + 3_600_000); // unreachable for a valid window; never spin
}
