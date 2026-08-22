export default function Logo({ light = false, className = '', iconOnly = false, size = 40 }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/logo.png" alt="IMSOP" style={{ height: size, width: 'auto' }} className="shrink-0" />
      {!iconOnly && (
        <span
          className={`font-display font-bold tracking-tight ${light ? 'text-white' : 'text-[var(--color-heading)]'}`}
          style={{ fontSize: size * 0.5 }}
        >
          IMSOP
        </span>
      )}
    </span>
  )
}
