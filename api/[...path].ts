/**
 * Vercel catch-all API Function.
 *
 * Keep Express as the single route implementation for local development and serverless deploys.
 * Disabling Vercel's body parser is essential: Express needs to receive the original JSON body
 * for encrypted Base64 uploads.
 */
import { createApp } from "../server";

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
  const app = await getApp();
  return app(req, res);
}
