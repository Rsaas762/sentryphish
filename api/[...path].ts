// Vercel serverless entrypoint.
// Vercel routes every /api/* request to this catch-all function. The Express app
// returned by createApp() is itself an (req, res) handler and already mounts its
// routers at /api/*, so it can serve the original request path directly.
import { createApp } from "../server/src/app";

export default createApp();
