import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = process.cwd();
const distDir = path.join(workspaceRoot, "dist");
const ssrDir = path.join(workspaceRoot, "dist-ssr");
const templatePath = path.join(distDir, "index.html");
const entryPath = path.join(ssrDir, "entry-server.js");

const template = await readFile(templatePath, "utf8");
const { PUBLIC_PRERENDER_ROUTES, renderPublicRoute } = await import(pathToFileURL(entryPath).href);
const spaShellPath = path.join(distDir, "spa-shell.html");

function injectRouteHtml(html, appHtml, headTags, route) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta name="description"[^>]*>/i, "")
    .replace(/<meta name="robots"[^>]*>/i, "")
    .replace(/<link rel="canonical"[^>]*>/i, "")
    .replace(/<meta property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta name="twitter:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<script id="app-seo-jsonld"[\s\S]*?<\/script>/i, "")
    .replace("</head>", `    ${headTags}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-prerender-path="${route}">${appHtml}</div>`,
    );
}

await writeFile(spaShellPath, template, "utf8");

for (const route of PUBLIC_PRERENDER_ROUTES) {
  const { appHtml, headTags } = renderPublicRoute(route);
  const html = injectRouteHtml(template, appHtml, headTags, route);
  const outputPath =
    route === "/"
      ? templatePath
      : path.join(distDir, route.replace(/^\/+/, ""), "index.html");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
}

await rm(ssrDir, { recursive: true, force: true });
