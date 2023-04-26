import path from "node:path";
import fs from "node:fs";
import { minimatch } from "minimatch";
import { MMRegExp } from "minimatch";
import {
  RouteManifest,
  ConfigRoute,
  normalizeSlashes,
} from "@remix-run/dev/dist/config/routes";
import {
  getRouteIdConflictErrorMessage,
  getRoutePathConflictErrorMessage,
} from "@remix-run/dev/dist/config/flat-routes";
import { findConfig } from "@remix-run/dev/dist/config";
import { routeModuleExts } from "@remix-run/dev/dist/config/routesConvention";
import { PrefixLookupTrie } from "./trie";
import {
  createRoutePath,
  findRouteModuleForFile,
  findRouteModuleForFolder,
  getRouteSegments,
} from "./utils";

export type CreateRoutesFromFeatureFoldersOptions = {
  /**
   * The directory where your app lives. Defaults to `app`.
   * @default "app"
   */
  appDirectory?: string;
  /**
   * A list of glob patterns to ignore when looking for route modules.
   * Defaults to `[]`.
   */
  ignoredFilePatterns?: string[];
};

function getRoutes(appDirectory: string, ignoredFilePatterns: string[] = []) {
  let ignoredFileRegex = ignoredFilePatterns
    .map((pattern) => minimatch.makeRe(pattern))
    .filter((r: any): r is MMRegExp => !!r);

  // Only read the routes directory
  let entries = fs.readdirSync(appDirectory, {
    withFileTypes: true,
    encoding: "utf-8",
  });

  let routes: string[] = [];
  for (let entry of entries) {
    let route: string | null = null;
    // If it's a directory, don't recurse into it, instead just look for a route module
    if (entry.isDirectory()) {
      route = findRouteModuleForFolder(
        appDirectory,
        entry.name,
        ignoredFileRegex
      );
    } else if (entry.isFile()) {
      route = findRouteModuleForFile(
        appDirectory,
        entry.name,
        ignoredFileRegex
      );
    }

    if (route) routes.push(route);
  }

  return routes;
}

export function createRoutesFromFolders(
  options: CreateRoutesFromFeatureFoldersOptions = {}
): RouteManifest {
  let { appDirectory = "app", ignoredFilePatterns = [] } = options;

  let routes = getRoutes(appDirectory, ignoredFilePatterns);
  let rootRoute = findConfig(appDirectory, "root", routeModuleExts);

  if (!rootRoute) {
    throw new Error(
      `Could not find a root route module in the app directory: ${appDirectory}`
    );
  }

  let urlConflicts = new Map<string, ConfigRoute[]>();
  let routeManifest: RouteManifest = {};
  let prefixLookup = new PrefixLookupTrie();
  let uniqueRoutes = new Map<string, ConfigRoute>();
  let routeIdConflicts = new Map<string, string[]>();

  // id -> file
  let routeIds = new Map<string, string>();

  for (let file of routes) {
    let normalizedFile = normalizeSlashes(file);
    let routeExt = path.extname(normalizedFile);
    let normalizedApp = normalizeSlashes(appDirectory);
    let routeId = normalizedFile.slice(0, -routeExt.length);

    let conflict = routeIds.get(routeId);
    if (conflict) {
      let currentConflicts = routeIdConflicts.get(routeId);
      if (!currentConflicts) {
        currentConflicts = [path.posix.relative(normalizedApp, conflict)];
      }
      currentConflicts.push(path.posix.relative(normalizedApp, normalizedFile));
      routeIdConflicts.set(routeId, currentConflicts);
      continue;
    }

    routeIds.set(routeId, normalizedFile);
  }

  let sortedRouteIds = Array.from(routeIds).sort(
    ([a], [b]) => b.length - a.length
  );

  for (let [routeId, file] of sortedRouteIds) {
    let isIndex = routeId.endsWith("_index.route");
    let routeIdNoFeature = routeId.slice(0);
    let noRouteEnding = routeIdNoFeature.replace(".route", "");
    let [segments, raw] = getRouteSegments(noRouteEnding);
    let pathname = createRoutePath(segments, raw, isIndex);

    routeManifest[routeId] = {
      file,
      id: routeId,
      path: pathname,
    };
    if (isIndex) routeManifest[routeId].index = true;
    let childRouteIds = prefixLookup.findAndRemove(routeId, (value) => {
      return [".", "/"].includes(value.slice(routeId.length).charAt(0));
    });
    prefixLookup.add(routeId);

    if (childRouteIds.length > 0) {
      for (let childRouteId of childRouteIds) {
        routeManifest[childRouteId].parentId = routeId;
      }
    }
  }

  // path creation
  let parentChildrenMap = new Map<string, ConfigRoute[]>();
  for (let [routeId] of sortedRouteIds) {
    let config = routeManifest[routeId];
    if (!config.parentId) continue;
    let existingChildren = parentChildrenMap.get(config.parentId) || [];
    existingChildren.push(config);
    parentChildrenMap.set(config.parentId, existingChildren);
  }

  for (let [routeId] of sortedRouteIds) {
    let config = routeManifest[routeId];
    let originalPathname = config.path || "";
    let pathname = config.path;
    let parentConfig = config.parentId ? routeManifest[config.parentId] : null;
    if (parentConfig?.path && pathname) {
      pathname = pathname
        .slice(parentConfig.path.length)
        .replace(/^\//, "")
        .replace(/\/$/, "");
    }

    let conflictRouteId = originalPathname + (config.index ? "?index" : "");
    let conflict = uniqueRoutes.get(conflictRouteId);

    if (!config.parentId) config.parentId = "root";
    config.path = pathname || undefined;
    uniqueRoutes.set(conflictRouteId, config);

    if (conflict && (originalPathname || config.index)) {
      let currentConflicts = urlConflicts.get(originalPathname);
      if (!currentConflicts) currentConflicts = [conflict];
      currentConflicts.push(config);
      urlConflicts.set(originalPathname, currentConflicts);
      continue;
    }
  }

  if (routeIdConflicts.size > 0) {
    for (let [routeId, files] of routeIdConflicts.entries()) {
      console.error(getRouteIdConflictErrorMessage(routeId, files));
    }
  }

  // report conflicts
  if (urlConflicts.size > 0) {
    for (let [path, routes] of urlConflicts.entries()) {
      // delete all but the first route from the manifest
      for (let i = 1; i < routes.length; i++) {
        delete routeManifest[routes[i].id];
      }
      let files = routes.map((r) => r.file);
      console.error(getRoutePathConflictErrorMessage(path, files));
    }
  }

  return routeManifest;
}
