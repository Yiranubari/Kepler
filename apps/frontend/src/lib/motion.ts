import type { Variants } from "motion/react";
export { useReducedMotion } from "motion/react";

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15, ease: "easeIn" } }
};

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: "easeIn" } }
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.14, ease: "easeIn" } }
};

export const stepForward: Variants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.18, ease: "easeIn" } }
};

export const stepBackward: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.18, ease: "easeIn" } }
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15, ease: "easeIn" } }
};

export const listContainer = (delayChildren = 0.04): Variants => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: delayChildren
    }
  },
  exit: {}
});

export const shake: Variants = {
  initial: { x: 0 },
  animate: {
    x: [0, -4, 4, -4, 4, 0],
    transition: { duration: 0.2, ease: "easeInOut" }
  },
  shake: {
    x: [0, -4, 4, -4, 4, 0],
    transition: { duration: 0.2, ease: "easeInOut" }
  }
};

export const statusPulse: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: { duration: 0.15, ease: "easeInOut" }
  },
  pulse: {
    scale: [1, 1.05, 1],
    transition: { duration: 0.15, ease: "easeInOut" }
  }
};
