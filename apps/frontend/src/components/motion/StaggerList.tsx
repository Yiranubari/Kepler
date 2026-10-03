import React, { createContext, useContext } from "react";
import { motion, type Variants } from "motion/react";
import { listContainer, listItem, useReducedMotion } from "@/lib/motion";

interface StaggerListContextValue {
  itemVariant: Variants;
}

const StaggerListContext = createContext<StaggerListContextValue>({
  itemVariant: listItem
});

export const useStaggerListItem = (): StaggerListContextValue => {
  return useContext(StaggerListContext);
};

export interface StaggerListProps {
  children: React.ReactNode;
  delayChildren?: number;
  className?: string;
}

export const StaggerList: React.FC<StaggerListProps> = ({
  children,
  delayChildren = 0.04,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <StaggerListContext.Provider value={{ itemVariant: listItem }}>
        <div className={className}>{children}</div>
      </StaggerListContext.Provider>
    );
  }

  return (
    <StaggerListContext.Provider value={{ itemVariant: listItem }}>
      <motion.div
        variants={listContainer(delayChildren)}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </StaggerListContext.Provider>
  );
};

export interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerItem: React.FC<StaggerItemProps> = ({ children, className }) => {
  const shouldReduceMotion = useReducedMotion();
  const { itemVariant } = useStaggerListItem();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={itemVariant} className={className}>
      {children}
    </motion.div>
  );
};
