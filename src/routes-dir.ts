import { findConfig } from "@remix-run/dev/dist/config";
import { routeModuleExts } from "@remix-run/dev/dist/config/routesConvention";
import path from "node:path";
import { createRoutePath, getRouteSegments } from "./utils";
import { getRoutePathConflictErrorMessage } from "@remix-run/dev/dist/config/flat-routes";

export function findRouteModuleForFolder(
  appDirectory: string,
  filepath: string,
  ignoredFileRegex: RegExp[]
): string | null {
  let relativePath = path.relative(appDirectory, filepath);
  let isIgnored = ignoredFileRegex.some((regex) => regex.test(relativePath));
  if (isIgnored) return null;

  let routeRouteModule = findConfig(filepath, "route", routeModuleExts);
  let routeIndexModule = findConfig(filepath, "index", routeModuleExts);

  // if both a route and index module exist, throw a conflict error
  // preferring the route module over the index module
  if (routeRouteModule && routeIndexModule) {
    let [segments, raw] = getRouteSegments(
      path.relative(appDirectory, filepath)
    );
    let routePath = createRoutePath(segments, raw, false);
    console.error(
      getRoutePathConflictErrorMessage(routePath || "/", [
        routeRouteModule,
        routeIndexModule,
      ])
    );
  }

  return routeRouteModule || routeIndexModule || null;
}

export function findRouteModuleForFile(
  appDirectory: string,
  filepath: string,
  ignoredFileRegex: RegExp[]
): string | null {
  let relativePath = path.relative(appDirectory, filepath);
  let isIgnored = ignoredFileRegex.some((regex) => regex.test(relativePath));
  if (isIgnored) return null;
  return filepath;
}
