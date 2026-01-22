import type { SymbolKind } from '../../types/symbols.js';

export const TYPESCRIPT_PATTERNS: Record<SymbolKind, string[]> = {
  function: [
    'function $NAME($$$) { $$$ }',
    'function $NAME($$$): $_ { $$$ }',
    'async function $NAME($$$) { $$$ }',
    'export function $NAME($$$) { $$$ }',
    'export async function $NAME($$$) { $$$ }',
    'export default function $NAME($$$) { $$$ }',
  ],
  class: [
    'class $NAME { $$$ }',
    'class $NAME extends $_ { $$$ }',
    'class $NAME implements $_ { $$$ }',
    'export class $NAME { $$$ }',
    'export default class $NAME { $$$ }',
    'abstract class $NAME { $$$ }',
  ],
  interface: [
    'interface $NAME { $$$ }',
    'interface $NAME extends $_ { $$$ }',
    'export interface $NAME { $$$ }',
  ],
  type: [
    'type $NAME = $_',
    'export type $NAME = $_',
  ],
  method: [
    '$NAME($$$) { $$$ }',
    '$NAME($$$): $_ { $$$ }',
    'async $NAME($$$) { $$$ }',
    'public $NAME($$$) { $$$ }',
    'private $NAME($$$) { $$$ }',
    'protected $NAME($$$) { $$$ }',
    'static $NAME($$$) { $$$ }',
  ],
  variable: [
    'const $NAME = $_',
    'let $NAME = $_',
    'var $NAME = $_',
    'export const $NAME = $_',
    'export let $NAME = $_',
  ],
  enum: [
    'enum $NAME { $$$ }',
    'export enum $NAME { $$$ }',
    'const enum $NAME { $$$ }',
  ],
  constant: [
    'const $NAME = $_',
    'export const $NAME = $_',
  ],
};

export const TYPESCRIPT_ARROW_FUNCTION_PATTERNS = [
  'const $NAME = ($$$) => $_',
  'const $NAME = async ($$$) => $_',
  'export const $NAME = ($$$) => $_',
  'export const $NAME = async ($$$) => $_',
];
