import React from "react";

export interface DotArrowProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotArrow: React.FC<DotArrowProps> = ({
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
      <circle cx="6" cy="26" r="1.8" fill="currentColor" />
      <circle cx="7" cy="25" r="1.8" fill="currentColor" />
      <circle cx="8" cy="24" r="1.8" fill="currentColor" />
      <circle cx="9" cy="23" r="1.8" fill="currentColor" />
      <circle cx="10" cy="22" r="1.8" fill="currentColor" />
      <circle cx="11" cy="21" r="1.8" fill="currentColor" />
      <circle cx="12" cy="20" r="1.8" fill="currentColor" />
      <circle cx="13" cy="19" r="1.8" fill="currentColor" />
      <circle cx="14" cy="6" r="1.8" fill="currentColor" />
      <circle cx="14" cy="18" r="1.8" fill="currentColor" />
      <circle cx="15" cy="17" r="1.8" fill="currentColor" />
      <circle cx="16" cy="16" r="1.8" fill="currentColor" />
      <circle cx="17" cy="15" r="1.8" fill="currentColor" />
      <circle cx="18" cy="6" r="1.8" fill="currentColor" />
      <circle cx="18" cy="14" r="1.8" fill="currentColor" />
      <circle cx="19" cy="13" r="1.8" fill="currentColor" />
      <circle cx="20" cy="12" r="1.8" fill="currentColor" />
      <circle cx="21" cy="11" r="1.8" fill="currentColor" />
      <circle cx="22" cy="6" r="1.8" fill="currentColor" />
      <circle cx="22" cy="10" r="1.8" fill="currentColor" />
      <circle cx="23" cy="9" r="1.8" fill="currentColor" />
      <circle cx="24" cy="8" r="1.8" fill="currentColor" />
      <circle cx="25" cy="7" r="1.8" fill="currentColor" />
      <circle cx="26" cy="6" r="1.8" fill="currentColor" />
      <circle cx="26" cy="10" r="1.8" fill="currentColor" />
      <circle cx="26" cy="14" r="1.8" fill="currentColor" />
      <circle cx="26" cy="18" r="1.8" fill="currentColor" />
    </svg>
  );
};
