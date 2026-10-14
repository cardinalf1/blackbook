/**
 * Formats a byte count into a human-readable string using binary units (1024 base).
 *
 * Examples:
 *   formatBytes(0)                  -> "0 B"
 *   formatBytes(512)                -> "512 B"
 *   formatBytes(1536)               -> "1.5 KB"
 *   formatBytes(43.2 * 1024 * 1024) -> "43.2 MB"
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = n;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }
  if (unitIndex === 0) {
    return `${Math.round(val)} B`;
  }
  const formatted = val.toFixed(1);
  const clean = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  return `${clean} ${units[unitIndex]}`;
}
