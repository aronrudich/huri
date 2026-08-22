/**
 * Static placeholder rows shown while a list is loading for the first time.
 * Keeps the layout height stable so nothing jumps when real data lands, and
 * avoids flashing an "empty" message before we know the list is empty.
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden className="divide-y divide-border bg-background">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-1/3 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted/70" />
          </div>
        </li>
      ))}
    </ul>
  );
}
