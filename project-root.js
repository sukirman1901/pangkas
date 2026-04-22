import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT_MARKERS = ['.git', 'package.json', 'AGENTS.md'];
const HOME = os.homedir();

export function findProjectRoot(startPath = process.cwd()) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root && current !== HOME) {
    for (const marker of ROOT_MARKERS) {
      const markerPath = path.join(current, marker);
      try {
        fs.accessSync(markerPath);
        return current;
      } catch {
        // continue
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(startPath);
}
