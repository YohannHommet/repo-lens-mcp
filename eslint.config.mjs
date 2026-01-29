import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  markdown: true,
  jsonc: true,
  yaml: true,

  // Custom rules if needed
  rules: {
    'no-console': 'off', // We are a CLI tool, console is fine
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
  },

  // Ignore specific files
  ignores: [
    'dist',
    'coverage',
    '**/*.d.ts',
    'CLAUDE.md',
    'REFACTORING_PLAN.md',
  ],
})
