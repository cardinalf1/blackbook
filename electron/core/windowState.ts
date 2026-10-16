// Window size, position and maximized state, remembered between runs. A saved position that is
// no longer on any screen (a monitor was unplugged) is dropped so the window never opens off-screen.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: Rect | null;
  maximized: boolean;
}

export const MIN_WIDTH = 1024;
export const MIN_HEIGHT = 680;
export const DEFAULT_SIZE = { width: 1440, height: 900 };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseWindowState(raw: unknown): WindowState {
  const empty: WindowState = { bounds: null, maximized: false };
  if (typeof raw !== 'object' || raw === null) return empty;
  const r = raw as { bounds?: unknown; maximized?: unknown };
  const maximized = r.maximized === true;
  const b = r.bounds as Partial<Rect> | null | undefined;
  if (!b || !isNum(b.x) || !isNum(b.y) || !isNum(b.width) || !isNum(b.height)) return { bounds: null, maximized };
  return { bounds: { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) }, maximized };
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Bounds to open with: the saved ones, at least the minimum size and no larger than the screen,
 * when enough of the window (a 100 x 60 patch) is on a screen. Otherwise null: let the OS centre it.
 */
export function restoreBounds(saved: Rect | null, workAreas: readonly Rect[]): Rect | null {
  if (!saved) return null;
  const area = workAreas.find((d) => overlap(saved, d) >= 100 * 60);
  if (!area) return null;
  const width = Math.min(Math.max(saved.width, MIN_WIDTH), area.width);
  const height = Math.min(Math.max(saved.height, MIN_HEIGHT), area.height);
  return { x: saved.x, y: saved.y, width, height };
}
