export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6.5L8 10.5L12 6.5" />
    </svg>
  );
}
