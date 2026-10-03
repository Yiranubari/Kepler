import React, { useEffect, useRef } from "react";
import { motion, useAnimationControls } from "motion/react";
import { shake, useReducedMotion } from "@/lib/motion";

export interface ShakeOnErrorProps {
  errorKey?: unknown;
  children: React.ReactNode;
  className?: string;
}

export const ShakeOnError: React.FC<ShakeOnErrorProps> = ({
  errorKey,
  children,
  className
}) => {
  const controls = useAnimationControls();
  const shouldReduceMotion = useReducedMotion();
  const previousErrorRef = useRef<unknown>(errorKey);

  useEffect(() => {
    const isNewTruthyError = Boolean(errorKey) && errorKey !== previousErrorRef.current;
    previousErrorRef.current = errorKey;

    if (isNewTruthyError && !shouldReduceMotion) {
      void controls.start("shake");
    }
  }, [errorKey, controls, shouldReduceMotion]);

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={shake}
      initial="initial"
      animate={controls}
      className={className}
    >
      {children}
    </motion.div>
  );
};
