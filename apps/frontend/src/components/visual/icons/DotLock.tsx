import React from "react";

export interface DotLockProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotLock: React.FC<DotLockProps> = ({
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
      <circle cx="8" cy="14" r="1.8" fill="currentColor" />
      <circle cx="8" cy="18" r="1.8" fill="currentColor" />
      <circle cx="8" cy="22" r="1.8" fill="currentColor" />
      <circle cx="8" cy="26" r="1.8" fill="currentColor" />
      <circle cx="11" cy="8" r="1.8" fill="currentColor" />
      <circle cx="11" cy="11" r="1.8" fill="currentColor" />
      <circle cx="11" cy="14" r="1.8" fill="currentColor" />
      <circle cx="12" cy="14" r="1.8" fill="currentColor" />
      <circle cx="12" cy="18" r="1.8" fill="currentColor" />
      <circle cx="12" cy="22" r="1.8" fill="currentColor" />
      <circle cx="12" cy="26" r="1.8" fill="currentColor" />
      <circle cx="13" cy="5" r="1.8" fill="currentColor" />
      <circle cx="16" cy="4" r="1.8" fill="currentColor" />
      <circle cx="16" cy="14" r="1.8" fill="currentColor" />
      <circle cx="16" cy="18" r="1.8" fill="currentColor" />
      <circle cx="16" cy="21" r="1.8" fill="currentColor" />
      <circle cx="16" cy="26" r="1.8" fill="currentColor" />
      <circle cx="19" cy="5" r="1.8" fill="currentColor" />
      <circle cx="20" cy="14" r="1.8" fill="currentColor" />
      <circle cx="20" cy="18" r="1.8" fill="currentColor" />
      <circle cx="20" cy="22" r="1.8" fill="currentColor" />
      <circle cx="20" cy="26" r="1.8" fill="currentColor" />
      <circle cx="21" cy="8" r="1.8" fill="currentColor" />
      <circle cx="21" cy="11" r="1.8" fill="currentColor" />
      <circle cx="21" cy="14" r="1.8" fill="currentColor" />
      <circle cx="24" cy="14" r="1.8" fill="currentColor" />
      <circle cx="24" cy="18" r="1.8" fill="currentColor" />
      <circle cx="24" cy="22" r="1.8" fill="currentColor" />
      <circle cx="24" cy="26" r="1.8" fill="currentColor" />
    </svg>
  );
};
