import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catch unhandled promises (IPC calls, async operations)
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Disable rules that conflict with project patterns
      '@typescript-eslint/no-unused-vars': 'off', // tsconfig handles this via noUnusedLocals
    },
  },
  {
    ignores: ['src/generated/**', 'src/test-utils/**', 'src/**/*.test.{ts,tsx}'],
  },
);
