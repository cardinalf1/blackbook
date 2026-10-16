import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extractInlineImages, FIGURE_SLOT_ATTR, splitFigures } from '../../services/exam/figures';
import { QuestionHtml } from '../QuestionHtml';
import { FigureFrame } from './FigureFrame';

type Zoom = ((percent: number) => void) | undefined;

/**
 * Question HTML with zoom controls on each figure (Phase 9). Top-level figures become frames;
 * pictures nested inside other markup get a frame rendered into their place. Zoom resets when the
 * question changes (the parent remounts).
 */
export function ContentHtml({ html, className = '', onFigureZoom }: { html: string; className?: string; onFigureZoom?: Zoom }) {
  const segments = useMemo(() => splitFigures(html), [html]);
  return (
    <div className={className}>
      {segments.map((s, i) =>
        s.kind === 'figure' ? (
          <div key={i} data-bb-figure-frame="">
            <FigureFrame html={s.html} onZoom={onFigureZoom} />
          </div>
        ) : (
          <HtmlWithInlineFigures key={i} html={s.html} onFigureZoom={onFigureZoom} />
        ),
      )}
    </div>
  );
}

/** HTML whose nested pictures are replaced by figure frames, rendered into their slots. */
function HtmlWithInlineFigures({ html, onFigureZoom }: { html: string; onFigureZoom: Zoom }) {
  const { html: withSlots, images } = useMemo(() => extractInlineImages(html), [html]);
  const host = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<HTMLElement[]>([]);

  // The slots exist once the HTML is in the page; find them after each change of HTML.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || images.length === 0) {
      setSlots([]);
      return;
    }
    setSlots(images.map((_, i) => el.querySelector<HTMLElement>(`[${FIGURE_SLOT_ATTR}="${i}"]`)).filter((s): s is HTMLElement => s !== null));
  }, [withSlots, images]);

  if (images.length === 0) return <QuestionHtml html={html} />;
  return (
    <div ref={host}>
      <QuestionHtml html={withSlots} />
      {slots.map((slot) => {
        const i = Number(slot.getAttribute(FIGURE_SLOT_ATTR));
        return createPortal(
          <span className="block" data-bb-figure-frame="">
            <FigureFrame html={images[i] as string} onZoom={onFigureZoom} />
          </span>,
          slot,
          `fig-${i}`,
        );
      })}
    </div>
  );
}
