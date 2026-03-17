import type { SymbolKind } from '../../types/symbols.js'

export const PHP_PATTERNS: Partial<Record<SymbolKind, string[]>> = {
  function: [
    'function $NAME($$$) { $$$ }',
    'function $NAME($$$): $_ { $$$ }',
  ],
  class: [
    'class $NAME { $$$ }',
    'class $NAME extends $_ { $$$ }',
    'class $NAME implements $_ { $$$ }',
    'class $NAME extends $_ implements $_ { $$$ }',
    'abstract class $NAME { $$$ }',
    'abstract class $NAME extends $_ { $$$ }',
    'final class $NAME { $$$ }',
    'final class $NAME extends $_ { $$$ }',
    'readonly class $NAME { $$$ }',
    // Traits mapped to class kind
    'trait $NAME { $$$ }',
  ],
  interface: [
    'interface $NAME { $$$ }',
    'interface $NAME extends $_ { $$$ }',
  ],
  enum: [
    'enum $NAME { $$$ }',
    'enum $NAME: $_ { $$$ }',
    'enum $NAME implements $_ { $$$ }',
    'enum $NAME: $_ implements $_ { $$$ }',
  ],
  method: [
    'public function $NAME($$$) { $$$ }',
    'public function $NAME($$$): $_ { $$$ }',
    'protected function $NAME($$$) { $$$ }',
    'protected function $NAME($$$): $_ { $$$ }',
    'private function $NAME($$$) { $$$ }',
    'private function $NAME($$$): $_ { $$$ }',
    'public static function $NAME($$$) { $$$ }',
    'public static function $NAME($$$): $_ { $$$ }',
    'protected static function $NAME($$$) { $$$ }',
    'private static function $NAME($$$) { $$$ }',
    'static function $NAME($$$) { $$$ }',
    'abstract public function $NAME($$$);',
    'abstract public function $NAME($$$): $_;',
    'abstract protected function $NAME($$$);',
    'abstract protected function $NAME($$$): $_;',
  ],
  constant: [
    'const $NAME = $$$;',
    'public const $NAME = $$$;',
    'protected const $NAME = $$$;',
    'private const $NAME = $$$;',
  ],
}
