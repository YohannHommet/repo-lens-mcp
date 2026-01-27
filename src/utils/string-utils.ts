/**
 * Centralized string utilities
 */

/**
 * Split a comma-separated string into an array of trimmed, non-empty strings.
 * Returns undefined if the input is undefined or effectively empty.
 */
export function splitCommaSeparated(value: string | undefined): string[] | undefined {
  if (!value)
    return undefined

  const parts = value
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)

  return parts.length > 0 ? parts : undefined
}
