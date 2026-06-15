import React from "react";

interface ShimmerLoaderProps {
  className?: string;
  variant?: "card" | "table" | "list" | "page";
  count?: number;
}

export default function ShimmerLoader({
  className = "",
  variant = "card",
  count = 3,
}: ShimmerLoaderProps) {
  const renderItem = () => {
    switch (variant) {
      case "card":
        return (
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl p-5 space-y-4 animate-pulse">
            <div className="h-6 bg-[var(--s3)] rounded-md w-2/3" />
            <div className="space-y-2">
              <div className="h-4 bg-[var(--s2)] rounded-md w-full" />
              <div className="h-4 bg-[var(--s2)] rounded-md w-5/6" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--b)]">
              <div className="h-4 bg-[var(--s3)] rounded-md w-1/4" />
              <div className="h-8 bg-[var(--s3)] rounded-md w-1/3" />
            </div>
          </div>
        );
      case "table":
        return (
          <div className="animate-pulse space-y-3">
            <div className="flex space-x-4">
              <div className="h-8 bg-[var(--s3)] rounded-md flex-1" />
              <div className="h-8 bg-[var(--s3)] rounded-md flex-1" />
              <div className="h-8 bg-[var(--s3)] rounded-md flex-1" />
            </div>
            <div className="border border-[var(--b)] rounded-lg divide-y divide-[var(--b)]">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex p-4 space-x-4">
                  <div className="h-5 bg-[var(--s2)] rounded-md flex-1" />
                  <div className="h-5 bg-[var(--s2)] rounded-md flex-1" />
                  <div className="h-5 bg-[var(--s2)] rounded-md flex-1" />
                </div>
              ))}
            </div>
          </div>
        );
      case "list":
        return (
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl p-4 space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center space-x-3 py-2 border-b border-[var(--b)] last:border-0">
                <div className="w-10 h-10 bg-[var(--s3)] rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--s3)] rounded-md w-1/3" />
                  <div className="h-3 bg-[var(--s2)] rounded-md w-1/2" />
                </div>
                <div className="w-16 h-6 bg-[var(--s3)] rounded-md" />
              </div>
            ))}
          </div>
        );
      case "page":
      default:
        return (
          <div className="p-6 space-y-6 animate-pulse bg-[var(--s0)] min-h-screen">
            {/* Topbar/Header Shimmer */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--b)]">
              <div className="space-y-2">
                <div className="h-6 bg-[var(--s3)] rounded-md w-48" />
                <div className="h-4 bg-[var(--s2)] rounded-md w-32" />
              </div>
              <div className="flex space-x-3">
                <div className="w-10 h-10 bg-[var(--s3)] rounded-lg" />
                <div className="w-10 h-10 bg-[var(--s3)] rounded-lg" />
              </div>
            </div>
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="h-40 bg-[var(--s1)] border border-[var(--b)] rounded-xl p-5 space-y-4">
                  <div className="h-6 bg-[var(--s3)] rounded-md w-1/3" />
                  <div className="h-4 bg-[var(--s2)] rounded-md w-full" />
                  <div className="h-4 bg-[var(--s2)] rounded-md w-2/3" />
                </div>
                <div className="h-60 bg-[var(--s1)] border border-[var(--b)] rounded-xl p-5 space-y-4">
                  <div className="h-6 bg-[var(--s3)] rounded-md w-1/4" />
                  <div className="space-y-3">
                    <div className="h-8 bg-[var(--s2)] rounded-md" />
                    <div className="h-8 bg-[var(--s2)] rounded-md" />
                    <div className="h-8 bg-[var(--s2)] rounded-md" />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="h-96 bg-[var(--s1)] border border-[var(--b)] rounded-xl p-5 space-y-4">
                  <div className="h-6 bg-[var(--s3)] rounded-md w-1/2" />
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-[var(--s2)] rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[var(--s2)] rounded-md w-1/3" />
                      <div className="h-3 bg-[var(--s2)] rounded-md w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-[var(--b)]">
                    <div className="h-4 bg-[var(--s2)] rounded-md w-full" />
                    <div className="h-4 bg-[var(--s2)] rounded-md w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (variant === "page" || variant === "table") {
    return <div className={className}>{renderItem()}</div>;
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <React.Fragment key={idx}>{renderItem()}</React.Fragment>
      ))}
    </div>
  );
}
