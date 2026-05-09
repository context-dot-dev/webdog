export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-cream-100">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-peach opacity-60 blur-3xl" />
        <div className="absolute top-40 -right-40 size-[420px] rounded-full bg-mint opacity-50 blur-3xl" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
