import { useMemo } from 'react';
import { renderMathHtml } from '../utils/renderMath';

/** Renders stored question HTML. Content was sanitized at sync and again at import. */
export function QuestionHtml({ html, className = '' }: { html: string; className?: string }) {
  const rendered = useMemo(() => renderMathHtml(html), [html]);
  return <div className={`bb-content ${className}`} dangerouslySetInnerHTML={{ __html: rendered }} />;
}
