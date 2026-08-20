/** @type {import('jest').Config} */
export default {
  rootDir: "./src",
  testRegex: ".*\\.test\\.ts$",
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
};
