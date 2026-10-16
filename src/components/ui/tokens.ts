// Phase 8 visual tokens: pure monochrome brutalism for the new Home and Dashboard screens.
// Black and near-black backgrounds, white text, 1px zinc borders, monospace labels and numbers,
// radius 0 to 2px, no gradients and no shadows. Color never carries meaning on its own: charts
// tell series apart by line style, marker shape and direct labels.
// Older screens keep their own classes until they adopt these (docs/later.md).

export const COLOR = {
  canvas: '#0A0A0C',
  black: '#000000',
  text: '#FFFFFF',
  muted: '#A1A1AA',
  faint: '#71717A',
  border: '#27272A',
  borderStrong: '#52525B',
} as const;

/** Stroke patterns for chart series, in order. Pair each with a marker shape and a direct label. */
export const SERIES_DASH: readonly string[] = ['', '6 4', '2 3', '10 3 2 3'];
export const SERIES_MARKER: readonly ('circle' | 'square' | 'triangle' | 'diamond')[] = ['circle', 'square', 'triangle', 'diamond'];

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black';

/** Tailwind class strings. Compose with clsx; do not invent new colors in the new screens. */
export const T = {
  page: 'bg-[#0A0A0C] text-white',
  card: 'rounded-[2px] border border-[#27272A] bg-black',
  cardPad: 'p-5',
  /** Small uppercase monospace label above a value or a card title. */
  label: 'font-mono text-[11px] uppercase tracking-wider text-zinc-400',
  title: 'font-mono text-sm font-semibold text-white',
  body: 'text-sm text-white',
  muted: 'text-xs text-zinc-400',
  num: 'font-mono tabular-nums',
  bigNum: 'font-mono text-2xl font-semibold tabular-nums text-white',
  /** The one primary action: white fill on dark. */
  primary: `rounded-[2px] bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-40 ${focus}`,
  secondary: `rounded-[2px] border border-[#27272A] bg-black px-4 py-2 text-sm text-white hover:border-zinc-500 disabled:opacity-40 ${focus}`,
  /** Plain text link styled as a button target (underlined on hover). */
  link: `rounded-[2px] text-sm text-white underline-offset-4 hover:underline ${focus}`,
  linkMuted: `rounded-[2px] text-xs text-zinc-400 underline-offset-4 hover:text-white hover:underline ${focus}`,
  /** Small outlined tag, e.g. "thin data", "approximation". */
  tag: 'inline-block rounded-[2px] border border-[#52525B] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300',
  input: `rounded-[2px] border border-[#27272A] bg-black px-2 py-1.5 text-sm text-white [color-scheme:dark] ${focus}`,
  segment: `px-3 py-1.5 font-mono text-xs ${focus}`,
  segmentOn: 'bg-white text-black',
  segmentOff: 'bg-black text-zinc-300 hover:text-white',
  focus,
} as const;
