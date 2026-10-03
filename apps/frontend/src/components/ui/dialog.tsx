import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export interface DialogOverlayProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {}

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, ...props }, ref) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        asChild
        {...props}
      >
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }
          }
          animate={{
            opacity: 1,
            scale: 1,
            x: "-50%",
            y: "-50%",
            transition: { duration: 0.18, ease: "easeOut" }
          }}
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  scale: 0.96,
                  x: "-50%",
                  y: "-50%",
                  transition: { duration: 0.14, ease: "easeIn" }
                }
          }
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/80 bg-background p-6 shadow-none rounded-lg",
            className
          )}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DialogFooter: React.FC<DialogFooterProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

export interface DialogTitleProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  DialogTitleProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export interface DialogDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> {}

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
