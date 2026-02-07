import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ReportProgressCardProps {
  progressPercentage: number;
}

export function ReportProgressCard({ progressPercentage }: ReportProgressCardProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Прогресс заполнения</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
