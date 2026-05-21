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

    if (path === "/api/change-password" && method === "POST") {
        const { oldPassword, newPassword } = await request.json();
        
        // 🟢 檢查是否有 Token 解析出的 user
        if (!request.user || !request.user.id) {
            return Response.json({ success: false, msg: "請先登入" }, { status: 401, headers: corsHeaders });
        }

        const userId = request.user.id;
        const person = await getDB().prepare(`SELECT password FROM People WHERE id = ?`).bind(userId).first();
        
        if (!person) return Response.json({ success: false, msg: "帳號不存在" }, { status: 404, headers: corsHeaders });

        const inputHash = await hashPassword(oldPassword, env.PASSWORD_SALT);
        if (person.password !== inputHash) {
            return Response.json({ success: false, msg: "舊密碼錯誤" }, { status: 400, headers: corsHeaders });
        }

        const newHash = await hashPassword(newPassword, env.PASSWORD_SALT);
        await getDB().prepare(`UPDATE People SET password = ?, must_change_password = 0 WHERE id = ?`).bind(newHash, userId).run();

        return Response.json({ success: true }, { headers: corsHeaders });
    }

    return null;
};