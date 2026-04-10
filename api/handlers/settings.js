export const handleSettings = async ({ request, env, path, method, corsHeaders }) => {
    if (path === "/api/settings/course-system") {
        if (method === "GET") {
            const status = await env.RUNBIKE_KV.get("COURSE_SYSTEM_STATUS", { type: "json" });
            return Response.json(status || { enabled: true }, { headers: corsHeaders });
        }
        if (method === "POST") {
            const body = await request.json();
            await env.RUNBIKE_KV.put("COURSE_SYSTEM_STATUS", JSON.stringify(body));
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/settings/ticket-pricing") {
        if (method === "GET") {
            const pricing = await env.RUNBIKE_KV.get("TICKET_PRICING", { type: "json" });
            const defaults = { regular_price: 400, racing_price: 700, group_practice_price: 150, special_tiers: [] };
            return Response.json(pricing || defaults, { headers: corsHeaders });
        }
        if (method === "POST") {
            const body = await request.json();
            await env.RUNBIKE_KV.put("TICKET_PRICING", JSON.stringify(body));
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/settings/bank-account") {
        if (method === "GET") {
            const account = await env.RUNBIKE_KV.get("BANK_ACCOUNT", { type: "json" });
            return Response.json(account || { bank_code: '', account_number: '' }, { headers: corsHeaders });
        }
        if (method === "POST") {
            const body = await request.json();
            await env.RUNBIKE_KV.put("BANK_ACCOUNT", JSON.stringify(body));
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/settings/push-templates") {
        if (method === "GET") return Response.json(await env.RUNBIKE_KV.get("PUSH_TEMPLATES", { type: "json" }) || {}, { headers: corsHeaders });
        if (method === "POST") { 
            await env.RUNBIKE_KV.put("PUSH_TEMPLATES", JSON.stringify(await request.json())); 
            return Response.json({ success: true }, { headers: corsHeaders }); 
        }
    }

    return null;
};