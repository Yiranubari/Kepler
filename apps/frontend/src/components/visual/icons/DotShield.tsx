import React from "react";

export interface DotShieldProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotShield: React.FC<DotShieldProps> = ({
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
      <circle cx="6" cy="6" r="1.8" fill="currentColor" />
      <circle cx="6" cy="10" r="1.8" fill="currentColor" />
      <circle cx="6" cy="14" r="1.8" fill="currentColor" />
      <circle cx="6" cy="18" r="1.8" fill="currentColor" />
      <circle cx="8" cy="22" r="1.8" fill="currentColor" />
      <circle cx="10" cy="6" r="1.8" fill="currentColor" />
      <circle cx="10" cy="25" r="1.8" fill="currentColor" />
      <circle cx="12" cy="15" r="1.8" fill="currentColor" />
      <circle cx="12" cy="27" r="1.8" fill="currentColor" />
      <circle cx="14" cy="6" r="1.8" fill="currentColor" />
      <circle cx="14" cy="29" r="1.8" fill="currentColor" />
      <circle cx="16" cy="6" r="1.8" fill="currentColor" />
      <circle cx="16" cy="11" r="1.8" fill="currentColor" />
      <circle cx="16" cy="15" r="1.8" fill="currentColor" />
      <circle cx="16" cy="19" r="1.8" fill="currentColor" />
      <circle cx="16" cy="23" r="1.8" fill="currentColor" />
      <circle cx="16" cy="30" r="1.8" fill="currentColor" />
      <circle cx="18" cy="6" r="1.8" fill="currentColor" />
      <circle cx="18" cy="29" r="1.8" fill="currentColor" />
      <circle cx="20" cy="15" r="1.8" fill="currentColor" />
      <circle cx="20" cy="27" r="1.8" fill="currentColor" />
      <circle cx="22" cy="6" r="1.8" fill="currentColor" />
      <circle cx="22" cy="25" r="1.8" fill="currentColor" />
      <circle cx="24" cy="22" r="1.8" fill="currentColor" />
      <circle cx="26" cy="6" r="1.8" fill="currentColor" />
      <circle cx="26" cy="10" r="1.8" fill="currentColor" />
      <circle cx="26" cy="14" r="1.8" fill="currentColor" />
      <circle cx="26" cy="18" r="1.8" fill="currentColor" />
    </svg>
  );
};
