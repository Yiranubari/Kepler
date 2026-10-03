import React from "react";

export interface DotSendProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotSend: React.FC<DotSendProps> = ({
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
      <circle cx="4" cy="22" r="1.8" fill="currentColor" />
      <circle cx="6" cy="19" r="1.8" fill="currentColor" />
      <circle cx="7" cy="20" r="1.8" fill="currentColor" />
      <circle cx="9" cy="17" r="1.8" fill="currentColor" />
      <circle cx="10" cy="21" r="1.8" fill="currentColor" />
      <circle cx="11" cy="17" r="1.8" fill="currentColor" />
      <circle cx="12" cy="14" r="1.8" fill="currentColor" />
      <circle cx="12" cy="25" r="1.8" fill="currentColor" />
      <circle cx="13" cy="20" r="1.8" fill="currentColor" />
      <circle cx="14" cy="19" r="1.8" fill="currentColor" />
      <circle cx="15" cy="12" r="1.8" fill="currentColor" />
      <circle cx="15" cy="14" r="1.8" fill="currentColor" />
      <circle cx="15" cy="16" r="1.8" fill="currentColor" />
      <circle cx="15" cy="21" r="1.8" fill="currentColor" />
      <circle cx="18" cy="13" r="1.8" fill="currentColor" />
      <circle cx="18" cy="17" r="1.8" fill="currentColor" />
      <circle cx="19" cy="9" r="1.8" fill="currentColor" />
      <circle cx="19" cy="11" r="1.8" fill="currentColor" />
      <circle cx="21" cy="13" r="1.8" fill="currentColor" />
      <circle cx="22" cy="10" r="1.8" fill="currentColor" />
      <circle cx="23" cy="7" r="1.8" fill="currentColor" />
      <circle cx="23" cy="8" r="1.8" fill="currentColor" />
      <circle cx="24" cy="9" r="1.8" fill="currentColor" />
      <circle cx="27" cy="5" r="1.8" fill="currentColor" />
    </svg>
  );
};
