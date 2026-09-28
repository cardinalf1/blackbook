import React, { useEffect, useRef, useState } from 'react';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import { X, Minimize2, Maximize2, Move, RotateCcw } from 'lucide-react';

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: any
      ) => any;
    };
  }
}

export const DesmosModal: React.FC = () => {
  const { isDesmosOpen, toggleDesmos } = useExamStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 40, y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize Desmos Graphing Calculator instance
  useEffect(() => {
    if (!isDesmosOpen || !containerRef.current) return;

    let destroyed = false;

    const initCalculator = () => {
      if (destroyed || !containerRef.current) return;

      if (window.Desmos && window.Desmos.GraphingCalculator) {
        // Clear previous children
        containerRef.current.innerHTML = '';

        try {
          calculatorRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
            keypad: true,
            graphpaper: true,
            settingsMenu: false,
            expressions: true,
            zoomButtons: true,
            border: false,
          });

          // Sample demo expression for immediate utility
          calculatorRef.current.setExpression({ id: 'graph1', latex: 'y=x^2 - 4' });
        } catch {
          // If Desmos initialization fails, fallback canvas is displayed
        }
      }
    };

    // If script not ready, retry briefly
    if (window.Desmos) {
      initCalculator();
    } else {
      const interval = setInterval(() => {
        if (window.Desmos) {
          clearInterval(interval);
          initCalculator();
        }
      }, 200);

      const timeout = setTimeout(() => clearInterval(interval), 5000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        destroyed = true;
      };
    }

    return () => {
      destroyed = true;
      if (calculatorRef.current && typeof calculatorRef.current.destroy === 'function') {
        try {
          calculatorRef.current.destroy();
        } catch {
          // Ignore
        }
        calculatorRef.current = null;
      }
    };
  }, [isDesmosOpen]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 300, e.clientX - dragStartRef.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 300, e.clientY - dragStartRef.current.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleReset = () => {
    if (calculatorRef.current && typeof calculatorRef.current.setBlank === 'function') {
      calculatorRef.current.setBlank();
    }
  };

  if (!isDesmosOpen) return null;

  return (
    <div
      style={
        isMaximized
          ? { top: '3.5rem', left: '0', width: '100vw', height: 'calc(100vh - 7.5rem)' }
          : { top: `${position.y}px`, left: `${position.x}px`, width: '600px', height: '480px' }
      }
      className={`fixed z-50 flex flex-col rounded-xl border shadow-2xl overflow-hidden transition-all duration-100 ${
        isDark ? 'bg-[#18181C] border-[#3F3F46]' : 'bg-white border-gray-300'
      }`}
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-10 px-3 flex items-center justify-between select-none cursor-move border-b ${
          isDark ? 'bg-[#121215] border-[#27272A] text-white' : 'bg-gray-100 border-gray-300 text-gray-800'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Move className="w-3.5 h-3.5 opacity-60" />
          <span>Desmos Graphing Calculator</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-xs"
            title="Clear expressions"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-xs"
            title={isMaximized ? 'Restore size' : 'Maximize window'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleDesmos}
            className="p-1 rounded hover:bg-rose-500 hover:text-white text-xs transition-colors"
            title="Close calculator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calculator Body with Stealth Dark Mode CSS Invert */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-white">
        <div
          ref={containerRef}
          style={isDark ? { filter: 'invert(0.9) hue-rotate(180deg)' } : {}}
          className="w-full h-full"
        />

        {/* Fallback note if script hasn't loaded */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center p-6 text-center text-sm text-gray-500">
          Loading Desmos Calculator API...
        </div>
      </div>
    </div>
  );
};
