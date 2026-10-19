export default function Stars({ value, className = 'text-base' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= Math.round(value) ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-700'}
        >
          ★
        </span>
      ))}
    </span>
  );
}
