import React from "react";

export interface DotCoinProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotCoin: React.FC<DotCoinProps> = ({
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
      <circle cx="7" cy="8" r="1.8" fill="currentColor" />
      <circle cx="7" cy="24" r="1.8" fill="currentColor" />
      <circle cx="11" cy="5" r="1.8" fill="currentColor" />
      <circle cx="11" cy="27" r="1.8" fill="currentColor" />
      <circle cx="12" cy="10" r="1.8" fill="currentColor" />
      <circle cx="12" cy="13" r="1.8" fill="currentColor" />
      <circle cx="12" cy="16" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
      <circle cx="12" cy="22" r="1.8" fill="currentColor" />
      <circle cx="14" cy="8" r="1.8" fill="currentColor" />
      <circle cx="14" cy="24" r="1.8" fill="currentColor" />
      <circle cx="15" cy="10" r="1.8" fill="currentColor" />
      <circle cx="15" cy="13" r="1.8" fill="currentColor" />
      <circle cx="15" cy="16" r="1.8" fill="currentColor" />
      <circle cx="15" cy="19" r="1.8" fill="currentColor" />
      <circle cx="15" cy="22" r="1.8" fill="currentColor" />
      <circle cx="16" cy="4" r="1.8" fill="currentColor" />
      <circle cx="16" cy="28" r="1.8" fill="currentColor" />
      <circle cx="17" cy="8" r="1.8" fill="currentColor" />
      <circle cx="17" cy="24" r="1.8" fill="currentColor" />
      <circle cx="18" cy="10" r="1.8" fill="currentColor" />
      <circle cx="18" cy="16" r="1.8" fill="currentColor" />
      <circle cx="18" cy="22" r="1.8" fill="currentColor" />
      <circle cx="19" cy="13" r="1.8" fill="currentColor" />
      <circle cx="19" cy="19" r="1.8" fill="currentColor" />
      <circle cx="21" cy="5" r="1.8" fill="currentColor" />
      <circle cx="21" cy="27" r="1.8" fill="currentColor" />
      <circle cx="25" cy="8" r="1.8" fill="currentColor" />
      <circle cx="25" cy="24" r="1.8" fill="currentColor" />
      <circle cx="27" cy="12" r="1.8" fill="currentColor" />
      <circle cx="27" cy="20" r="1.8" fill="currentColor" />
      <circle cx="28" cy="16" r="1.8" fill="currentColor" />
    </svg>
  );
};
