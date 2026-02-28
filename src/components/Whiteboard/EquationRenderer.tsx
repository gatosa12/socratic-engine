'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface EquationRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
  animate?: boolean;
}

export function EquationRenderer({
  latex,
  displayMode = true,
  className = '',
  animate = true,
}: EquationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !latex) return;

    // Dynamic import to avoid SSR issues
    import('katex').then((katex) => {
      if (!containerRef.current) return;
      try {
        katex.default.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode,
          trust: false,
          strict: false,
          macros: {
            '\\R': '\\mathbb{R}',
            '\\N': '\\mathbb{N}',
            '\\Z': '\\mathbb{Z}',
            '\\d': '\\,\\mathrm{d}',
          },
        });
      } catch {
        if (containerRef.current) {
          containerRef.current.textContent = latex;
        }
      }
    });
  }, [latex, displayMode]);

  const Wrapper = animate ? motion.div : 'div';
  const animProps = animate
    ? {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.3, ease: 'easeOut' },
      }
    : {};

  return (
    <Wrapper
      {...animProps}
      className={`katex-container overflow-x-auto ${className}`}
    >
      <div ref={containerRef} />
    </Wrapper>
  );
}
