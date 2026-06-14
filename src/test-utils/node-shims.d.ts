// Minimal ambient Node typings for Node-environment tests that read fixture
// files directly. `@types/node` is intentionally not part of the frontend
// tsconfig, so declare only the tiny surface the tests need.

declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: string): string;
}
