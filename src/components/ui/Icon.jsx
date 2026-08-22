export default function Icon({ name, filled = false, className = '', style, ...props }) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'icon-fill' : ''} ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1", ...style } : style}
      {...props}
    >
      {name}
    </span>
  )
}
