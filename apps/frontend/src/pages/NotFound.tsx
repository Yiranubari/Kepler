import React from "react";
import { useNavigate } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Page not found"
        subtitle="The page you requested does not exist."
      />
      <EmptyState
        icon={FileQuestion}
        title="We could not find that"
        description="The link you followed may be broken or the page may have been moved."
        actionLabel="Go to home"
        onAction={() => navigate("/")}
      />
    </div>
  );
};
