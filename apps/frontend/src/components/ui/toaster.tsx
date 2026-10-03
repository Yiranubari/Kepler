import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose
} from "@/components/ui/toast";
import { toast, type ToastItem } from "@/lib/toast";
import { useReducedMotion } from "@/lib/motion";

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    return toast.subscribe((updated) => {
      setToasts(updated);
    });
  }, []);

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 640;

  return (
    <ToastProvider swipeDirection="right">
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout={!shouldReduceMotion}
            transition={{
              layout: { duration: 0.1 }
            }}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, x: 24 }
                : { opacity: 0, y: 16 }
            }
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              transition: { duration: 0.2, ease: "easeOut" }
            }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, x: 24, transition: { duration: 0.15, ease: "easeIn" } }
                : { opacity: 0, y: 16, transition: { duration: 0.15, ease: "easeIn" } }
            }
            className="w-full"
          >
            <Toast
              variant={item.type}
              duration={item.durationMs}
              onOpenChange={(open) => {
                if (!open) {
                  toast.dismiss(item.id);
                }
              }}
            >
              <div className="shrink-0 mt-0.5">
                {item.type === "error" && (
                  <AlertCircle className="w-4 h-4 text-destructive" aria-label="Error" />
                )}
                {item.type === "success" && (
                  <CheckCircle className="w-4 h-4 text-accent" aria-label="Success" />
                )}
                {item.type === "info" && (
                  <Info className="w-4 h-4 text-muted-foreground" aria-label="Information" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                {item.title && <ToastTitle>{item.title}</ToastTitle>}
                <ToastDescription>{item.message}</ToastDescription>
              </div>
              <ToastClose />
            </Toast>
          </motion.div>
        ))}
      </AnimatePresence>
      <ToastViewport />
    </ToastProvider>
  );
};
