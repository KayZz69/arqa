import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="mb-8 flex items-start justify-between animate-fade-in">
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-9 w-20 rounded-xl hidden md:block" />
        </div>

        <div className="space-y-6">
          {/* Hero Card Skeleton */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="gradient-primary p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl bg-primary-foreground/20" />
                  <div>
                    <Skeleton className="h-5 w-36 mb-2 bg-primary-foreground/20" />
                    <Skeleton className="h-4 w-28 bg-primary-foreground/20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-full bg-primary-foreground/20" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl bg-primary-foreground/20" />
            </div>
          </Card>

          {/* Progress Card Skeleton */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full rounded-full" />
            </CardContent>
          </Card>

          {/* Navigation Cards Skeleton */}
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManagerDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="mb-8 flex items-start justify-between animate-fade-in">
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-9 w-20 rounded-xl hidden md:block" />
        </div>

        <div className="space-y-6">
          {/* Metrics Skeleton */}
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div>
                      <Skeleton className="h-8 w-12 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Navigation Cards Skeleton */}
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div>
                      <Skeleton className="h-5 w-20 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Quick Links Skeleton */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-40 rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
