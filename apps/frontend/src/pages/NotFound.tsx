import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { Button } from "@/components/ui/button";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUp}
      initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
      animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
      className="w-full min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
    >
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4">
        <FileQuestion className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        The link you followed may be broken or the page may have been moved.
      </p>
      <Button variant="primary" size="md" onClick={() => navigate("/")}>
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        <span>Back to home</span>
      </Button>
    </motion.div>
  );
};
