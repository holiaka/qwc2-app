#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const mapViewerConfigPath = path.join(
  repoRoot,
  "volumes",
  "config",
  "default",
  "mapViewerConfig.json"
);
const themesOutputPath = path.join(appRoot, "static", "themes.json");
const customThemesPath = path.join(appRoot, "static", "customThemes.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(mapViewerConfigPath)) {
  fail(
    `Generated map viewer config not found: ${path.relative(repoRoot, mapViewerConfigPath)}`
  );
}

const mapViewerConfig = readJson(mapViewerConfigPath);
const generatedThemes = mapViewerConfig.resources?.qwc2_themes;

if (!generatedThemes?.themes?.items) {
  fail(
    "Generated qwc2 themes were not found in volumes/config/default/mapViewerConfig.json. Run the QWC config generator first."
  );
}

function serviceUrl(baseUrl, serviceName) {
  return `${baseUrl.replace(/\/?$/, "/")}${serviceName.replace(/^\//, "")}?`;
}

const standaloneThemes = JSON.parse(JSON.stringify(generatedThemes));
const viewerConfig = mapViewerConfig.config || {};

function patchKnownTheme(theme) {
  if (theme.id !== "chez") {
    return theme;
  }
  return {
    ...theme,
    title: theme.title === "chez" ? "ChEZ" : theme.title,
    url: "/ows/scan/chez",
    wms_name: "scan/chez",
    featureInfoUrl: "/api/v1/featureinfo/scan/chez?",
    legendUrl: "/api/v1/legend/scan/chez?",
    printUrl: "/ows/scan/chez?"
  };
}

standaloneThemes.themes.items = standaloneThemes.themes.items.map((theme) => {
  if (!theme.wms_name) {
    return patchKnownTheme(theme);
  }
  return patchKnownTheme({
    ...theme,
    featureInfoUrl:
      theme.featureInfoUrl ||
      serviceUrl(viewerConfig.info_service_url || "/api/v1/featureinfo/", theme.wms_name),
    legendUrl:
      theme.legendUrl ||
      serviceUrl(viewerConfig.legend_service_url || "/api/v1/legend/", theme.wms_name),
    printUrl:
      theme.printUrl ||
      serviceUrl(viewerConfig.ogc_service_url || "/ows/", theme.wms_name),
  });
});

standaloneThemes.themes.items = standaloneThemes.themes.items.filter(
  (theme) => theme.id !== "test" && theme.wms_name !== "scan/test"
);

if (fs.existsSync(customThemesPath)) {
  const customThemes = readJson(customThemesPath).themes || {};
  const appendByKey = (items, customItems, key) => {
    const result = [...(items || [])];
    for (const customItem of customItems || []) {
      const existingIndex = result.findIndex((item) => item[key] === customItem[key]);
      if (existingIndex >= 0) {
        result[existingIndex] = customItem;
      } else {
        result.push(customItem);
      }
    }
    return result;
  };

  standaloneThemes.themes.items = appendByKey(
    standaloneThemes.themes.items,
    customThemes.items,
    "id"
  );
  standaloneThemes.themes.backgroundLayers = appendByKey(
    standaloneThemes.themes.backgroundLayers,
    customThemes.backgroundLayers,
    "name"
  );
  standaloneThemes.themes.externalLayers = appendByKey(
    standaloneThemes.themes.externalLayers,
    customThemes.externalLayers,
    "name"
  );

  if (customThemes.defaultTheme) {
    standaloneThemes.themes.defaultTheme = customThemes.defaultTheme;
  }
}

const hasDefaultTheme = standaloneThemes.themes.items.some(
  (theme) => theme.id === standaloneThemes.themes.defaultTheme
);
if (!hasDefaultTheme || standaloneThemes.themes.defaultTheme === "test") {
  standaloneThemes.themes.defaultTheme = standaloneThemes.themes.items.some(
    (theme) => theme.id === "chez"
  )
    ? "chez"
    : standaloneThemes.themes.items[0]?.id;
}

writeJson(themesOutputPath, standaloneThemes);

const themeCount = standaloneThemes.themes.items.length;
const layerCount = standaloneThemes.themes.items.reduce((count, theme) => {
  const countLayers = (layers = []) =>
    layers.reduce(
      (sum, layer) => sum + 1 + countLayers(layer.sublayers || []),
      0
    );
  return count + countLayers(theme.sublayers || []);
}, 0);

console.log(
  `Synced ${themeCount} themes and ${layerCount} layer tree entries to ${path.relative(repoRoot, themesOutputPath)}`
);
