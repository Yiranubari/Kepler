import React from "react";

export interface DotGearProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotGear: React.FC<DotGearProps> = ({
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
      <circle cx="3" cy="16" r="1.8" fill="currentColor" />
      <circle cx="5" cy="16" r="1.8" fill="currentColor" />
      <circle cx="7" cy="7" r="1.8" fill="currentColor" />
      <circle cx="7" cy="25" r="1.8" fill="currentColor" />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
      <circle cx="8" cy="16" r="1.8" fill="currentColor" />
      <circle cx="8" cy="24" r="1.8" fill="currentColor" />
      <circle cx="9" cy="11" r="1.8" fill="currentColor" />
      <circle cx="9" cy="21" r="1.8" fill="currentColor" />
      <circle cx="11" cy="9" r="1.8" fill="currentColor" />
      <circle cx="11" cy="23" r="1.8" fill="currentColor" />
      <circle cx="14" cy="14" r="1.8" fill="currentColor" />
      <circle cx="14" cy="18" r="1.8" fill="currentColor" />
      <circle cx="16" cy="3" r="1.8" fill="currentColor" />
      <circle cx="16" cy="5" r="1.8" fill="currentColor" />
      <circle cx="16" cy="8" r="1.8" fill="currentColor" />
      <circle cx="16" cy="24" r="1.8" fill="currentColor" />
      <circle cx="16" cy="27" r="1.8" fill="currentColor" />
      <circle cx="16" cy="29" r="1.8" fill="currentColor" />
      <circle cx="18" cy="14" r="1.8" fill="currentColor" />
      <circle cx="18" cy="18" r="1.8" fill="currentColor" />
      <circle cx="21" cy="9" r="1.8" fill="currentColor" />
      <circle cx="21" cy="23" r="1.8" fill="currentColor" />
      <circle cx="23" cy="11" r="1.8" fill="currentColor" />
      <circle cx="23" cy="21" r="1.8" fill="currentColor" />
      <circle cx="24" cy="8" r="1.8" fill="currentColor" />
      <circle cx="24" cy="16" r="1.8" fill="currentColor" />
      <circle cx="24" cy="24" r="1.8" fill="currentColor" />
      <circle cx="25" cy="7" r="1.8" fill="currentColor" />
      <circle cx="25" cy="25" r="1.8" fill="currentColor" />
      <circle cx="27" cy="16" r="1.8" fill="currentColor" />
      <circle cx="29" cy="16" r="1.8" fill="currentColor" />
    </svg>
  );
};
