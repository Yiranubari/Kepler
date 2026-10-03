import React from "react";

export interface DotClockProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotClock: React.FC<DotClockProps> = ({
  size = 32,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      {...props}
    >
      <circle cx="4" cy="16" r="1.8" fill="currentColor" />
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="5" cy="20" r="1.8" fill="currentColor" />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
      <circle cx="8" cy="24" r="1.8" fill="currentColor" />
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="27" r="1.8" fill="currentColor" />
      <circle cx="16" cy="4" r="1.8" fill="currentColor" />
      <circle cx="16" cy="10" r="1.8" fill="currentColor" />
      <circle cx="16" cy="13" r="1.8" fill="currentColor" />
      <circle cx="16" cy="16" r="1.8" fill="currentColor" />
      <circle cx="16" cy="28" r="1.8" fill="currentColor" />
      <circle cx="19" cy="16" r="1.8" fill="currentColor" />
      <circle cx="20" cy="5" r="1.8" fill="currentColor" />
      <circle cx="20" cy="27" r="1.8" fill="currentColor" />
      <circle cx="22" cy="16" r="1.8" fill="currentColor" />
      <circle cx="24" cy="8" r="1.8" fill="currentColor" />
      <circle cx="24" cy="24" r="1.8" fill="currentColor" />
      <circle cx="27" cy="12" r="1.8" fill="currentColor" />
      <circle cx="27" cy="20" r="1.8" fill="currentColor" />
      <circle cx="28" cy="16" r="1.8" fill="currentColor" />
    </svg>
  );
};
