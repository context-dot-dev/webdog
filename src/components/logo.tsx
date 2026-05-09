import { APP_NAME } from "@/lib/product-info";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark className="size-7" />
      <span className="text-neutral-900">{APP_NAME}</span>
    </span>
  );
}

export function LogoMark({ className = "size-7" }: { className?: string }) {
  // An abstract watchful eye that doubles as a "W" — dot inside a shield-like curve.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="webdog-mark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff7a3b" />
          <stop offset="100%" stopColor="#f0420a" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#webdog-mark)" />
      <path
        d="M5 9 L8 16 L10.5 11 L12 14.5 L14 11 L16 16 L19 9"
        fill="none"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="6" r="1.1" fill="white" />
    </svg>
  );
}
