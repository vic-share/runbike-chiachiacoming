import { handleApiRequest } from './handlers/api.js';
import { handleScheduled } from './handlers/scheduled.js';

export default {
    async fetch(request, env, ctx) {
        return await handleApiRequest(request, env, ctx);
    },
    async scheduled(event, env, ctx) {
        return await handleScheduled(event, env, ctx);
    }
};