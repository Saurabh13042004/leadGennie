/**
 * A `date` column as "YYYY-MM-DD", whatever the driver hands back. Depending on the driver a date arrives as a
 * string, a Date at UTC midnight, or a Date at LOCAL midnight; String(date).slice(0, 10) is wrong for the
 * latter two ("Sun Sep 20"), and silently wrong dates are worse than none.
 */
export function dateOnly(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const utcMidnight = v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0;
    const y = utcMidnight ? v.getUTCFullYear() : v.getFullYear();
    const m = (utcMidnight ? v.getUTCMonth() : v.getMonth()) + 1;
    const d = utcMidnight ? v.getUTCDate() : v.getDate();
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
