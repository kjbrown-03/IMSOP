import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merges conditional class lists while letting later Tailwind utilities win over
// earlier conflicting ones, so callers can override a component's defaults by
// simply passing a className.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
