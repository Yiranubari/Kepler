import React from "react";

export interface DotEyeProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotEye: React.FC<DotEyeProps> = ({
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
      <circle cx="7" cy="12" r="1.8" fill="currentColor" />
      <circle cx="7" cy="20" r="1.8" fill="currentColor" />
      <circle cx="11" cy="9" r="1.8" fill="currentColor" />
      <circle cx="11" cy="23" r="1.8" fill="currentColor" />
      <circle cx="13" cy="16" r="1.8" fill="currentColor" />
      <circle cx="14" cy="14" r="1.8" fill="currentColor" />
      <circle cx="14" cy="18" r="1.8" fill="currentColor" />
      <circle cx="15" cy="16" r="1.8" fill="currentColor" />
      <circle cx="16" cy="8" r="1.8" fill="currentColor" />
      <circle cx="16" cy="12" r="1.8" fill="currentColor" />
      <circle cx="16" cy="14" r="1.8" fill="currentColor" />
      <circle cx="16" cy="16" r="1.8" fill="currentColor" />
      <circle cx="16" cy="18" r="1.8" fill="currentColor" />
      <circle cx="16" cy="20" r="1.8" fill="currentColor" />
      <circle cx="16" cy="24" r="1.8" fill="currentColor" />
      <circle cx="17" cy="16" r="1.8" fill="currentColor" />
      <circle cx="18" cy="14" r="1.8" fill="currentColor" />
      <circle cx="18" cy="18" r="1.8" fill="currentColor" />
      <circle cx="19" cy="16" r="1.8" fill="currentColor" />
      <circle cx="21" cy="9" r="1.8" fill="currentColor" />
      <circle cx="21" cy="23" r="1.8" fill="currentColor" />
      <circle cx="25" cy="12" r="1.8" fill="currentColor" />
      <circle cx="25" cy="20" r="1.8" fill="currentColor" />
      <circle cx="28" cy="16" r="1.8" fill="currentColor" />
    </svg>
  );
};
