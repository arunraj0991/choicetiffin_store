// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ignore native CMake/Gradle build dirs so Metro doesn't crash on Windows
// when those temp folders are created/deleted during `expo run:android`.
const nativeBuildJunk = [
  /[\\/]node_modules[\\/].*[\\/]android[\\/]\.cxx[\\/].*/,
  /[\\/]node_modules[\\/].*[\\/]android[\\/]build[\\/].*/,
  /[\\/]android[\\/]\.cxx[\\/].*/,
  /[\\/]android[\\/]app[\\/]build[\\/].*/,
  /[\\/]android[\\/]build[\\/].*/,
];

const existingBlockList = config.resolver.blockList;
if (Array.isArray(existingBlockList)) {
  config.resolver.blockList = [...existingBlockList, ...nativeBuildJunk];
} else if (existingBlockList) {
  config.resolver.blockList = [existingBlockList, ...nativeBuildJunk];
} else {
  config.resolver.blockList = nativeBuildJunk;
}

module.exports = config;
