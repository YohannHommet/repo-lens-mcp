import type { SymbolKind } from '../../types/symbols.js'
import type { SearchPattern } from './index.js'

/**
 * PHP patterns use kind-based rules instead of pattern strings because
 * the PHP tree-sitter grammar (via @ast-grep/lang-php) doesn't support
 * ast-grep's pattern string matching. Kind-based rules match AST node types
 * directly and work reliably.
 */
export const PHP_PATTERNS: Partial<Record<SymbolKind, SearchPattern[]>> = {
  function: [
    { rule: { kind: 'function_definition' }, nameChildKind: 'name' },
  ],
  class: [
    { rule: { kind: 'class_declaration' }, nameChildKind: 'name' },
    { rule: { kind: 'trait_declaration' }, nameChildKind: 'name' },
  ],
  interface: [
    { rule: { kind: 'interface_declaration' }, nameChildKind: 'name' },
  ],
  enum: [
    { rule: { kind: 'enum_declaration' }, nameChildKind: 'name' },
  ],
  method: [
    { rule: { kind: 'method_declaration' }, nameChildKind: 'name' },
  ],
  constant: [
    { rule: { kind: 'const_declaration' }, nameChildKind: 'const_element>name' },
  ],
}
