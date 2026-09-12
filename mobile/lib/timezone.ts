import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { format, formatDistanceToNow } from "date-fns";

const IST = "Asia/Kolkata";

/**
 * Parse an ISO timestamp (always UTC) and format for IST display.
 * All backend timestamps are UTC — this is the ONLY place to convert.
 */

/** "5 Sep 2026, 18:00" IST */
export function formatIstDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "d MMM yyyy, HH:mm");
}

/** "5 Sep 2026" IST */
export function formatIstDate(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "d MMM yyyy");
}

/** "5 Sep" IST — short for chart labels */
export function formatIstShort(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "d MMM");
}

/** "2 hours ago" relative time (from now) */
export function formatRelativeTime(iso: string): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** "Thursday, 5 September 2026" IST — greeting header */
export function formatIstFullDate(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "EEEE, d MMMM yyyy");
}

/** "18:00 IST" for display with explicit IST suffix */
export function formatIstTime(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "HH:mm");
}
