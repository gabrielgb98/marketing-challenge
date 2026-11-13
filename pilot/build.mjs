import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_CLASSRUSH_PILOT: "1" },
});
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};
const assets = {};
for (const file of readdirSync("out", { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const extension = extname(file.name);
  if (!types[extension]) continue;
  const path = join(file.parentPath, file.name);
  const route = path.slice(3).replace(/\/index\.html$/, "") || "/";
  assets[route] = [types[extension], readFileSync(path).toString("base64")];
}
writeFileSync("pilot/generated-assets.mjs", "export const assets = " + JSON.stringify(assets) + ";\n");
mkdirSync("dist/server", { recursive: true });
execFileSync(process.env.CLASSRUSH_ESBUILD || "esbuild", [
  "pilot/worker.js", "--bundle", "--minify", "--format=esm", "--outfile=dist/server/index.js",
], { stdio: "inherit" });
