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
        if (path === "/api/env.js") {
            const script = `window.ENV = window.ENV || {}; window.ENV.VITE_SUPABASE_URL = "${env.VITE_SUPABASE_URL || ''}"; window.ENV.VITE_SUPABASE_ANON_KEY = "${env.VITE_SUPABASE_ANON_KEY || ''}"; window.ENV.VAPID_PUBLIC_KEY = "${env.VAPID_PUBLIC_KEY || 'BAcjQfCcruqwU6OicgOJh66UR6125vX_rcsk-G_ddnQYdwI2XJK0jKYNF1IckZdqDfu7DvOOaVUFHd-PigfJ2jw'}";`;
            return new Response(script, { headers: { "Content-Type": "application/javascript", ...corsHeaders } });
        }

        let response = null;

        // ⚠️ 路由分發：如果子模組沒有回傳 Response，會保留為 null
        if (path.startsWith("/api/people") || path === "/api/lookup" || path === "/api/login") {
            response = await handlePeople(context);
        } else if (path.startsWith("/api/notifications") || path === "/api/subscribe" || path === "/api/unsubscribe" || path === "/api/admin/push") {
            response = await handleNotifications(context);
        } else if (path.startsWith("/api/race-") || path.startsWith("/api/overview/")) {
            response = await handleRaces(context);
        } else if (path.startsWith("/api/courses/")) {
            response = await handleCourses(context);
        } else if (path.startsWith("/api/finance/") || path.startsWith("/api/tickets/")) {
            response = await handleFinanceAndTickets(context);
        } else if (path.startsWith("/api/training-")) {
            response = await handleTraining(context);
        } else if (path.startsWith("/api/settings/")) {
            response = await handleSettings(context);
        }

        // ⚠️ 安全攔截：如果有對應的 response 就回傳，否則統一丟出 404
        if (response) {
            return response;
        }
        
        return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
};