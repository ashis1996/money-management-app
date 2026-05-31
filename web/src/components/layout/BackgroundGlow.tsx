/**
 * Ambient background — the radial cyan/blue glow that gives the
 * MoneyMind shell its "luminous depth" without paying for a real-time
 * particle simulation. Two soft radial gradients positioned in
 * opposite corners; pointer-events disabled so it doesn't intercept
 * clicks.
 */
export function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(closest-side, rgba(34,211,238,0.10), transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(closest-side, rgba(59,130,246,0.10), transparent 70%)',
        }}
      />
    </div>
  );
}
