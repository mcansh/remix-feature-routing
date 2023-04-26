import fs from "node:fs";
import path from "node:path";

export function findRouteModuleForFile(
  _appDirectory: string,
  filepath: string,
  ignoredFileRegex: RegExp[]
): string | null {
  let ext = path.extname(filepath);
  let basename = path.basename(filepath, ext);
  if (!basename.endsWith(".route")) return null;
  let isIgnored = ignoredFileRegex.some((regex) => regex.test(filepath));
  if (isIgnored) return null;
  return filepath;
}

export function findRouteModuleForFolder(
  appDirectory: string,
  filepath: string,
  ignoredFileRegex: RegExp[]
): string | null {
  let dirEntries = fs.readdirSync(path.join(appDirectory, filepath), {
    withFileTypes: true,
    encoding: "utf-8",
  });

  let file = dirEntries.find((e) => {
    let ext = path.extname(e.name);
    let base = path.basename(e.name, ext);
    return base.endsWith(".route");
  });

  if (!file) return null;

  let isIgnored = ignoredFileRegex.some((regex) => regex.test(file!.name));
  if (isIgnored) return null;

  if (file.isDirectory()) {
    throw new Error(`no .route on a folder pls`);
  }

  return file.name;
}
