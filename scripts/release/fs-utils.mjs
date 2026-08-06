import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Return every file under `root` as a POSIX-style relative path. Directories
 * are recursed; symlinks are not followed. Order is stable per platform and
 * callers typically sort the result for determinism.
 */
export function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(relative(root, full).split(sep).join("/"));
      }
    }
  }
  return out;
}
