export function SkeletonMessage({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full skeleton" />
      <div className={`flex flex-col gap-2 max-w-[65%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton rounded-xl p-4 w-full space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
      </div>
    </div>
  );
}
