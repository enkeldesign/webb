import challengeWorker from './index.js';
import { handleTelemetryRoute, isTelemetryRoute } from './telemetry.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (isTelemetryRoute(path)) {
      return handleTelemetryRoute(request, env, ctx);
    }
    return challengeWorker.fetch(request, env, ctx);
  }
};
