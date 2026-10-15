/**
 * Formats remaining milliseconds into a countdown string.
 * Ceils to whole seconds, never negative.
 * Formats "M:SS" under an hour, and "H:MM:SS" at or above an hour.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0 || !Number.isFinite(ms)) {
    return '0:00';
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedMinutes = String(minutes).padStart(2, '0');
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}
