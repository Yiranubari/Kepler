import React from "react";
import { cn } from "@/lib/utils";

export interface DotVignetteProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
}

export const DotVignette: React.FC<DotVignetteProps> = ({
  className,
  ...props
}) => {
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("opacity-[0.03] pointer-events-none", className)}
      {...props}
    >
      <defs>
        <pattern
          id="dot-vignette-pattern"
          x="0"
          y="0"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </pattern>
        <radialGradient id="vignette-mask-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="35%" stopColor="black" stopOpacity="0" />
          <stop offset="75%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </radialGradient>
        <mask id="vignette-mask">
          <rect width="100%" height="100%" fill="url(#vignette-mask-gradient)" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="url(#dot-vignette-pattern)"
        mask="url(#vignette-mask)"
      />
    </svg>
  );
};
