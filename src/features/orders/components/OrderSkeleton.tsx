import { Skeleton } from "@/components/ui/skeleton";

export function OrderSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
    </div>
  );
}