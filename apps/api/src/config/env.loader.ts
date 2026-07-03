import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'dotenv';

/** Load .env files without letting blank values in a later file wipe keys from an earlier one. */
export function loadMergedEnv(): Record<string, string> {
  const paths = [join(process.cwd(), '../../.env'), join(process.cwd(), '.env')];
  const merged: Record<string, string> = {};

  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const parsed = parse(readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== '' || !(key in merged)) {
        merged[key] = value;
      }
    }
  }

  return merged;
}
