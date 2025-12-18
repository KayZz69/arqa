import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DailyReportSkeleton() {
  return (
    <div className="container mx-auto p-4 md:p-6 pb-24 md:pb-6 min-h-screen">
      {/* Header Skeleton */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-36 mt-2" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[200px] rounded-md" />
        </div>
      </div>

      {/* Progress Bar Skeleton */}
      <div className="mb-6">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Categories Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((categoryIndex) => (
          <Card key={categoryIndex} className="animate-fade-in" style={{ animationDelay: `${categoryIndex * 100}ms` }}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4].map((itemIndex) => (
                  <PositionCardSkeleton key={itemIndex} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PositionCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-28 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-11 w-11 rounded-md" />
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 w-11 rounded-md" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </Card>
  );
}
