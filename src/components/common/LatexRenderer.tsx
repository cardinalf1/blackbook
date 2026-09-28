import React, { useMemo } from 'react';
import katex from 'katex';

interface LatexRendererProps {
  content: string;
  className?: string;
  isInline?: boolean;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({
  content,
  className = '',
  isInline = false,
}) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // First replace display math $$...$$
    let formatted = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, equation) => {
      try {
        return katex.renderToString(equation.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return `<span class="katex-error">${equation}</span>`;
      }
    });

    // Next replace inline math $...$ (make sure not to match single currency signs like $50)
    // A standard inline math expression has non-space or typical math chars
    formatted = formatted.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (match, equation) => {
      // Check if it looks like a currency amount, e.g. $50 or $12.50
      if (/^\d+(\.\d{1,2})?$/.test(equation.trim())) {
        return match;
      }
      try {
        return katex.renderToString(equation.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `<span class="katex-error">${equation}</span>`;
      }
    });

    return formatted;
  }, [content]);

  if (isInline) {
    return (
      <span
        className={`latex-content inline ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  return (
    <div
      className={`latex-content leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
