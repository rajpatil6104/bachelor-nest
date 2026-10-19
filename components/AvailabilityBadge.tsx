

export default function AvailabilityBadge({ beds }: { beds: number }) {
  if (beds > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        {beds} bed{beds === 1 ? '' : 's'} available
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
      <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
      Full
    </span>
  );
}

