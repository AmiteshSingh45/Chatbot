"use client";

/**
 * SkeletonMessage — premium shimmer placeholder for loading states.
 */
export default function SkeletonMessage({ isUser = false }: { isUser?: boolean }) {
  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex flex-col items-end gap-2 max-w-[60%]">
          <div className="skeleton h-10 rounded-2xl rounded-tr-sm w-full" />
        </div>
        <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex gap-3.5">
      <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="skeleton h-4 w-16 rounded-full" />
        <div className="skeleton h-4 w-full rounded-lg" />
        <div className="skeleton h-4 w-[88%] rounded-lg" />
        <div className="skeleton h-4 w-[72%] rounded-lg" />
        <div className="skeleton h-4 w-[80%] rounded-lg" />
      </div>
    </div>
  );
}
