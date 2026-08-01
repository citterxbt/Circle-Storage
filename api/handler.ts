/**
 * Vercel API Function.
 *
 * `vercel.json` rewrites every `/api/*` request here with its original path in `path`. Vercel's
 * plain Vite runtime treats `[...path].ts` as a literal filename, so this explicit rewrite is
 * necessary for the Express application's catch-all API surface.
 */
// `npm run build` creates this self-contained server bundle before Vercel traces Functions.
// Importing the source `../server` leaves it outside Vercel's Function bundle and crashes at
// runtime with ERR_MODULE_NOT_FOUND.
import { createApp } from "../dist/server.mjs";

let appPromise: ReturnType<typeof createApp> | undefined;

function getApp() {
  if (!appPromise) appPromise = createApp({ serveFrontend: false });
  return appPromise;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  const routePath = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
  if (typeof routePath === "string" && routePath.length > 0) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === "path") continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        if (typeof item === "string") query.append(key, item);
      }
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    req.url = `/api/${routePath.replace(/^\/+/, "")}${suffix}`;
  }

  const app = await getApp();
  return app(req, res);
}
