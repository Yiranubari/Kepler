import React from "react";

export interface DotLinkProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotLink: React.FC<DotLinkProps> = ({
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
      <circle cx="6" cy="12" r="1.8" fill="currentColor" />
      <circle cx="6" cy="16" r="1.8" fill="currentColor" />
      <circle cx="9" cy="9" r="1.8" fill="currentColor" />
      <circle cx="9" cy="19" r="1.8" fill="currentColor" />
      <circle cx="12" cy="23" r="1.8" fill="currentColor" />
      <circle cx="13" cy="6" r="1.8" fill="currentColor" />
      <circle cx="13" cy="22" r="1.8" fill="currentColor" />
      <circle cx="14" cy="16" r="1.8" fill="currentColor" />
      <circle cx="14" cy="20" r="1.8" fill="currentColor" />
      <circle cx="15" cy="26" r="1.8" fill="currentColor" />
      <circle cx="17" cy="6" r="1.8" fill="currentColor" />
      <circle cx="17" cy="22" r="1.8" fill="currentColor" />
      <circle cx="18" cy="12" r="1.8" fill="currentColor" />
      <circle cx="18" cy="16" r="1.8" fill="currentColor" />
      <circle cx="19" cy="13" r="1.8" fill="currentColor" />
      <circle cx="19" cy="26" r="1.8" fill="currentColor" />
      <circle cx="20" cy="9" r="1.8" fill="currentColor" />
      <circle cx="23" cy="10" r="1.8" fill="currentColor" />
      <circle cx="23" cy="23" r="1.8" fill="currentColor" />
      <circle cx="26" cy="13" r="1.8" fill="currentColor" />
      <circle cx="26" cy="16" r="1.8" fill="currentColor" />
      <circle cx="26" cy="20" r="1.8" fill="currentColor" />
    </svg>
  );
};
