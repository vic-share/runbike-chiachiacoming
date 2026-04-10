import { sendPushToRole, createNotificationForRole } from '../services/push.js';

export const handleNotifications = async ({ request, env, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    if (path === "/api/notifications/unread-count") {
        try {
            const userId = url.searchParams.get('user_id');
            if (!userId) return Response.json({ count: 0 }, { headers: corsHeaders });
            const result = await getDB().prepare("SELECT COUNT(*) as count FROM SystemNotifications WHERE user_id = ? AND is_read = 0 AND team_id = ?").bind(userId, TEAM_ID).first();
            return Response.json(result || { count: 0 }, { headers: corsHeaders });
        } catch (e) {
            return Response.json({ count: 0, error: e.message }, { headers: corsHeaders });
        }
    }
    if (path === "/api/notifications") {
        const userId = url.searchParams.get('user_id');
        const { results } = await getDB().prepare("SELECT id, team_id, user_id, title, action_link, is_read, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM SystemNotifications WHERE user_id = ? AND team_id = ? ORDER BY created_at DESC LIMIT 30").bind(userId, TEAM_ID).all();
        return Response.json(results, { headers: corsHeaders });
    }
    if (path === "/api/notifications/read" && method === "POST") {
        const { id, user_id } = await request.json();
        await getDB().prepare("UPDATE SystemNotifications SET is_read = 1 WHERE id = ? AND user_id = ?").bind(id, user_id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
    }
    if (path === "/api/notifications/read-all" && method === "POST") {
        const { user_id } = await request.json();
        await getDB().prepare("UPDATE SystemNotifications SET is_read = 1 WHERE user_id = ? AND team_id = ?").bind(user_id, TEAM_ID).run();
        return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (path === "/api/admin/push" && method === "POST") { 
        // 🚨 修正：確保前端傳來的 url 正確對應，並補回寫入資料庫的邏輯
        const { title, body, url: targetUrl, target_role } = await request.json(); 
        const count = await sendPushToRole(env, target_role || 'all', title, body, targetUrl); 
        await createNotificationForRole(getDB(), target_role || 'all', title, targetUrl); // 補回這行：寫入鈴鐺通知
        return Response.json({ success: true, sent_count: count }, { headers: corsHeaders }); 
    }
    if (path === "/api/subscribe" && method === "POST") { 
        const sub = await request.json(); 
        await getDB().prepare("DELETE FROM PushSubscriptions WHERE endpoint = ?").bind(sub.endpoint).run(); 
        await getDB().prepare("INSERT INTO PushSubscriptions (endpoint, p256dh, auth, people_id) VALUES (?, ?, ?, ?)").bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.people_id).run(); 
        return Response.json({ success: true }, { headers: corsHeaders }); 
    }
    if (path === "/api/unsubscribe" && method === "POST") { 
        const sub = await request.json(); 
        await getDB().prepare("DELETE FROM PushSubscriptions WHERE endpoint = ?").bind(sub.endpoint).run(); 
        return Response.json({ success: true }, { headers: corsHeaders }); 
    }

    return null;
};