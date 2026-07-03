const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(monorepoRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

// Watch shared package only — not the full monorepo (avoids broken api/dist watchers).
config.watchFolders = [...new Set([...(config.watchFolders ?? []), sharedRoot])];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
