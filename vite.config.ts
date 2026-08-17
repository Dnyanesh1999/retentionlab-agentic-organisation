import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    // `.claude/worktrees/**` is excluded because an agent session can create a git worktree inside
    // the repository. That is a full second copy of the tree, so without this the suite collects and
    // runs every test twice — observed on 17 August as 1025 tests instead of 515, from a worktree a
    // deleted session left behind.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/worktrees/**",
      "supabase/functions/**/*.test.ts",
    ],
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
