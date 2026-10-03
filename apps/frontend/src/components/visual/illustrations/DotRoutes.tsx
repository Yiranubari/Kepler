import React from "react";
import { cn } from "@/lib/utils";

export interface DotRoutesProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export const DotRoutes: React.FC<DotRoutesProps> = ({
  size = 360,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 360 360"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 select-none", className)}
      {...props}
    >
      <circle cx="175.0" cy="312.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="170.2" cy="304.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="165.3" cy="296.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="160.6" cy="288.0" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="156.0" cy="279.8" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="151.4" cy="271.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="146.9" cy="263.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="142.4" cy="254.7" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="138.1" cy="246.2" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="133.8" cy="237.6" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="129.6" cy="228.9" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="125.5" cy="220.2" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="121.5" cy="211.4" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="117.5" cy="202.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="113.6" cy="193.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="109.8" cy="184.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="106.1" cy="175.4" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="102.4" cy="166.2" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="98.8" cy="156.9" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="95.3" cy="147.6" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="91.9" cy="138.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="88.5" cy="128.6" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="85.2" cy="119.0" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="82.0" cy="109.4" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="78.9" cy="99.7" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="75.9" cy="89.8" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="72.9" cy="80.0" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="185.0" cy="312.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="189.8" cy="304.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="194.7" cy="296.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="199.4" cy="288.0" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="204.0" cy="279.8" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="208.6" cy="271.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="213.1" cy="263.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="217.6" cy="254.7" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="221.9" cy="246.2" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="226.2" cy="237.6" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="230.4" cy="228.9" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="234.5" cy="220.2" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="238.5" cy="211.4" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="242.5" cy="202.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="246.4" cy="193.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="250.2" cy="184.5" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="253.9" cy="175.4" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="257.6" cy="166.2" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="261.2" cy="156.9" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="264.7" cy="147.6" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="268.1" cy="138.1" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="271.5" cy="128.6" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="274.8" cy="119.0" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="278.0" cy="109.4" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="281.1" cy="99.7" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="284.1" cy="89.8" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="287.1" cy="80.0" r="1.8" fill="currentColor" opacity="0.55" />
      <circle cx="180.0" cy="310.4" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="300.7" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="291.1" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="281.4" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="271.8" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="262.1" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="252.5" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="242.9" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="233.2" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="223.6" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="213.9" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="204.3" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="194.6" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="185.0" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="175.4" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="165.7" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="156.1" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="146.4" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="136.8" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="127.1" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="117.5" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="107.9" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="98.2" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="88.6" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="78.9" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="69.3" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180.0" cy="59.6" r="2.0" fill="hsl(var(--accent))" opacity="0.9" />
      <circle cx="180" cy="320" r="3.0" fill="currentColor" opacity="0.75" />
      <circle cx="188.0" cy="320.0" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="184.0" cy="326.9" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="176.0" cy="326.9" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="172.0" cy="320.0" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="176.0" cy="313.1" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="184.0" cy="313.1" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="70" cy="70" r="3.0" fill="currentColor" opacity="0.75" />
      <circle cx="78.0" cy="70.0" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="74.0" cy="76.9" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="66.0" cy="76.9" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="62.0" cy="70.0" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="66.0" cy="63.1" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="74.0" cy="63.1" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="180" cy="50" r="3.0" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="188.0" cy="50.0" r="1.8" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="184.0" cy="56.9" r="1.8" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="176.0" cy="56.9" r="1.8" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="172.0" cy="50.0" r="1.8" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="176.0" cy="43.1" r="1.8" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="184.0" cy="43.1" r="1.8" fill="hsl(var(--accent))" opacity="0.95" />
      <circle cx="290" cy="70" r="3.0" fill="currentColor" opacity="0.75" />
      <circle cx="298.0" cy="70.0" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="294.0" cy="76.9" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="286.0" cy="76.9" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="282.0" cy="70.0" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="286.0" cy="63.1" r="1.8" fill="currentColor" opacity="0.75" />
      <circle cx="294.0" cy="63.1" r="1.8" fill="currentColor" opacity="0.75" />
    </svg>
  );
};
