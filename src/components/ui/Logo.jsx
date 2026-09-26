/**
 * Marque IMSOP : l'icône et le mot, alignés.
 *
 * `leading-none` sur le texte n'est pas cosmétique : sans lui, la boîte du
 * texte est plus haute que les lettres (interligne par défaut), et
 * `items-center` centre cette boîte — les glyphes paraissent alors décalés
 * vers le haut par rapport à l'icône.
 */
export default function Logo({ light = false, className = '', iconOnly = false, size = 40 }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/logo.png" alt="IMSOP" style={{ height: size, width: 'auto' }} className="shrink-0" />
      {!iconOnly && (
        <span
          className={`font-display font-bold tracking-tight leading-none ${light ? 'text-white' : 'text-[var(--color-heading)]'}`}
          style={{ fontSize: size * 0.5 }}
        >
          IMSOP
        </span>
      )}
    </span>
  )
}
