import React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitives.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed z-50 flex flex-col gap-2 p-4 sm:top-4 sm:right-4 sm:bottom-auto bottom-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto w-full max-w-sm pointer-events-none",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> {
  variant?: "success" | "error" | "info";
}

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant = "info", duration, ...props }, ref) => {
  const autoDuration = duration ?? (variant === "error" ? 8000 : 4000);

  return (
    <ToastPrimitives.Root
      ref={ref}
      duration={autoDuration}
      className={cn(
        "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 shadow-none backdrop-blur-sm transition-all duration-100",
        variant === "error"
          ? "border-destructive/50 bg-background text-foreground"
          : variant === "success"
          ? "border-accent/40 bg-background text-foreground"
          : "border-border bg-background text-foreground",
        className
      )}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
    <span className="sr-only">Close</span>
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold text-foreground", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground mt-0.5", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;
