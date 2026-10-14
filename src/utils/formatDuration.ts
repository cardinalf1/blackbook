/**
 * Formats a duration in milliseconds as "m:ss".
 * Rounds to the nearest second and is never negative.
 *
 * Examples:
 *   formatDuration(65000) -> "1:05"
 *   formatDuration(0)     -> "0:00"
 *   formatDuration(-100)  -> "0:00"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
