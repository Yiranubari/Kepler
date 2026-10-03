import React, { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";

export interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  formatFn?: (val: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  durationMs = 500,
  formatFn,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(shouldReduceMotion ? value : 0);
  const previousValueRef = useRef<number>(shouldReduceMotion ? value : 0);
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      previousValueRef.current = value;
      return;
    }

    const startValue = isMountedRef.current ? previousValueRef.current : 0;
    isMountedRef.current = true;
    previousValueRef.current = value;

    if (startValue === value) {
      setDisplayValue(value);
      return;
    }

    const startTime = performance.now();
    let frameId: number;

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * easeOutProgress);

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [value, durationMs, shouldReduceMotion]);

  const formatted = formatFn ? formatFn(displayValue) : displayValue.toLocaleString();

  return <span className={className}>{formatted}</span>;
};
