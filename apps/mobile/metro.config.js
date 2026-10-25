// The app shares the website's framework-independent code where it lives (../../src: core, geo, data), under the
// same "@/" imports the website uses. The repository root is not an npm workspace, so this is set up here rather
// than by Expo's monorepo detection.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "../../src");

const config = getDefaultConfig(projectRoot);

// The Quick Challenge's share card template is the website's (public/images/share), required as "@/../public/…".
const shareTemplates = path.resolve(projectRoot, "../../public/images/share");

config.watchFolders = [...(config.watchFolders ?? []), sharedRoot, shareTemplates];

const isBareImport = (name) => !name.startsWith(".") && !path.isAbsolute(name);
const inSharedCode = (file) => [sharedRoot, shareTemplates].some((root) => file.startsWith(root + path.sep));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // "@/core/…" → ../../src/core/…, from this app's code and inside the shared code alike.
  if (moduleName.startsWith("@/")) {
    return context.resolveRequest(context, path.join(sharedRoot, moduleName.slice(2)), platform);
  }
  // Packages the shared code imports (d3-geo, topojson-client), and those an image there needs (its asset registry),
  // resolve from this app's node_modules, never the website's, so the app bundles the versions in its own package.json.
  if (inSharedCode(context.originModulePath) && isBareImport(moduleName)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, "package.json") }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
