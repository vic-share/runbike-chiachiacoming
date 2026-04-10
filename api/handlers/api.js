import { handlePeople } from './people.js';
import { handleNotifications } from './notifications.js';
import { handleRaces } from './races.js';
import { handleCourses } from './courses.js';
import { handleFinanceAndTickets } from './finance.js';
import { handleTraining } from './training.js';
import { handleSettings } from './settings.js';

const TEAM_ID = 1;

export const handleApiRequest = async (request, env, ctx) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Token, X-OTP",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const getDB = () => env.RUNBIKE_DB;

    const context = { request, env, ctx, url, path, method, getDB, TEAM_ID, corsHeaders };

    try {
        // 環境變數腳本 (唯一直接在這裡處理的路由)
        if (path === "/api/env.js") {
            const script = `window.ENV = window.ENV || {}; window.ENV.VITE_SUPABASE_URL = "${env.VITE_SUPABASE_URL || ''}"; window.ENV.VITE_SUPABASE_ANON_KEY = "${env.VITE_SUPABASE_ANON_KEY || ''}"; window.ENV.VAPID_PUBLIC_KEY = "${env.VAPID_PUBLIC_KEY || 'BAcjQfCcruqwU6OicgOJh66UR6125vX_rcsk-G_ddnQYdwI2XJK0jKYNF1IckZdqDfu7DvOOaVUFHd-PigfJ2jw'}";`;
            return new Response(script, { headers: { "Content-Type": "application/javascript", ...corsHeaders } });
        }

        // 模組化路由分流
        if (path.startsWith("/api/people") || path === "/api/lookup" || path === "/api/login") {
            return await handlePeople(context);
        }
        if (path.startsWith("/api/notifications") || path === "/api/subscribe" || path === "/api/unsubscribe" || path === "/api/admin/push") {
            return await handleNotifications(context);
        }
        if (path.startsWith("/api/race-") || path.startsWith("/api/overview/")) {
            return await handleRaces(context);
        }
        if (path.startsWith("/api/courses/")) {
            return await handleCourses(context);
        }
        if (path.startsWith("/api/finance/") || path.startsWith("/api/tickets/")) {
            return await handleFinanceAndTickets(context);
        }
        if (path.startsWith("/api/training-")) {
            return await handleTraining(context);
        }
        if (path.startsWith("/api/settings/")) {
            return await handleSettings(context);
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
};