import React from "react";
import { cn } from "@/lib/utils";

export interface DotGridProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
}

export const DotGrid: React.FC<DotGridProps> = ({
  className,
  ...props
}) => {
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("opacity-[0.02] pointer-events-none", className)}
      {...props}
    >
      <defs>
        <pattern
          id="dot-grid-pattern"
          x="0"
          y="0"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid-pattern)" />
    </svg>
  );
};
