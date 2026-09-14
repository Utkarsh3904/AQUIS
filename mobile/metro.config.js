const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Detect if this is a web build
const isWeb =
  process.argv.includes("--platform") &&
  process.argv[process.argv.indexOf("--platform") + 1] === "web";

if (isWeb) {
  // Block react-native-maps from Metro resolution on web.
  // Metro will skip this module entirely during bundling.
  const mapsDir = path.resolve(__dirname, "node_modules", "react-native-maps");
  const escapedDir = mapsDir.replace(/[\\\/]/g, "[\\\\\/]");
  const mapsBlock = new RegExp(escapedDir + ".*");

  const existing = config.resolver.blockList;
  const blockArray = existing instanceof RegExp ? [existing] : [];
  config.resolver.blockList = [...blockArray, mapsBlock];
}

module.exports = config;
