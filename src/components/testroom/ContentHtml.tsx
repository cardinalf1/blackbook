import { useMemo } from 'react';
import { splitFigures } from '../../services/exam/figures';
import { QuestionHtml } from '../QuestionHtml';
import { FigureFrame } from './FigureFrame';

/** Question HTML with zoom controls on each figure (Phase 9). Zoom resets when the question changes (the parent remounts). */
export function ContentHtml({ html, className = '', onFigureZoom }: { html: string; className?: string; onFigureZoom?: (percent: number) => void }) {
  const segments = useMemo(() => splitFigures(html), [html]);
  return (
    <div className={className}>
      {segments.map((s, i) =>
        s.kind === 'figure' ? <FigureFrame key={i} html={s.html} onZoom={onFigureZoom} /> : <QuestionHtml key={i} html={s.html} />,
      )}
    </div>
  );
}
