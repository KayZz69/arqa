import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Lock } from "lucide-react";

type ReportStatus = "draft" | "submitted" | "locked";

interface ReportStatusBadgeProps {
  status: ReportStatus;
  className?: string;
}

export function ReportStatusBadge({ status, className }: ReportStatusBadgeProps) {
  const config = {
    draft: {
      label: "Черновик",
      icon: Clock,
      variant: "secondary" as const,
    },
    submitted: {
      label: "Отправлен",
      icon: CheckCircle2,
      variant: "default" as const,
    },
    locked: {
      label: "Заблокирован",
      icon: Lock,
      variant: "destructive" as const,
    },
  };

  const { label, icon: Icon, variant } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
