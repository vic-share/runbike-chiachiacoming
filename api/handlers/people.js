import { hashPassword } from '../utils/auth.js';

export const handlePeople = async ({ request, env, path, method, getDB, TEAM_ID, corsHeaders }) => {
    if (path === "/api/lookup" && method === "POST") {
        const { table, id, name, is_hidden, ...extras } = await request.json();
        if (table === 'people') {
            let query = "UPDATE People SET name = ?, is_retired = ?";
            const params = [name, is_hidden ? 1 : 0];
            if (extras.full_name !== undefined) { query += ", full_name = ?"; params.push(extras.full_name); }
            if (extras.birthday !== undefined) { query += ", birthday = ?"; params.push(extras.birthday); }
            if (extras.roles !== undefined) { query += ", roles = ?"; params.push(JSON.stringify(extras.roles)); }
            if (extras.bio !== undefined || extras.myword !== undefined) { query += ", bio = ?"; params.push(extras.bio || extras.myword); }
            if (extras.s_url !== undefined) { query += ", avatar_url = ?"; params.push(extras.s_url); }
            if (extras.b_url !== undefined) { query += ", full_photo_url = ?"; params.push(extras.b_url); }
            if (extras.password) {
                const hash = await hashPassword(extras.password, env.PASSWORD_SALT);
                query += ", password = ?";
                params.push(hash);
            }
            query += " WHERE id = ? AND team_id = ?";
            params.push(id, TEAM_ID);
            await getDB().prepare(query).bind(...params).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
        return Response.json({ success: false, msg: "Unknown table" }, { headers: corsHeaders });
    }

    if (path === "/api/people") {
        if (method === "GET") {
            return Response.json((await getDB().prepare(`SELECT id, team_id, name, roles, birthday, avatar_url as s_url, full_photo_url as b_url, bio as myword, is_retired as is_hidden, full_name FROM People WHERE team_id = ${TEAM_ID}`).all()).results, { headers: corsHeaders });
        }
        if (method === "POST") {
            const { name, full_name, birthday, roles } = await request.json();
            const defaultPass = await hashPassword("123456", env.PASSWORD_SALT);
            const res = await getDB().prepare("INSERT INTO People (team_id, name, full_name, birthday, roles, password) VALUES (?, ?, ?, ?, ?, ?)").bind(TEAM_ID, name, full_name, birthday || null, JSON.stringify(roles || ['RIDER']), defaultPass).run();
            return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
        }
    }

    if (path === "/api/people/trial" && method === "POST") {
        const { name } = await request.json();
        const passwordHash = await hashPassword(name, env.PASSWORD_SALT);
        const res = await getDB().prepare("INSERT INTO People (team_id, name, roles, is_retired, password) VALUES (?, ?, ?, 1, ?)").bind(TEAM_ID, name, JSON.stringify(['TRIAL']), passwordHash).run();
        return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
    }

if (path === "/api/change-password" && method === "POST") {
    const { oldPassword, newPassword } = await request.json();

    // 從 Authorization header 取 token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
        return Response.json({ success: false, msg: "請先登入" }, { status: 401, headers: corsHeaders });
    }

    // 從 KV 取出 session
    const sessionData = await env.RUNBIKE_KV.get(`SESSION_${token}`, { type: "json" });
    if (!sessionData || !sessionData.id) {
        return Response.json({ success: false, msg: "Session 已過期，請重新登入" }, { status: 401, headers: corsHeaders });
    }

    const userId = sessionData.id;

    // 驗證舊密碼
    const person = await getDB().prepare(`SELECT password FROM People WHERE id = ?`).bind(userId).first();
    if (!person) {
        return Response.json({ success: false, msg: "帳號不存在" }, { status: 404, headers: corsHeaders });
    }

    const inputHash = await hashPassword(oldPassword, env.PASSWORD_SALT);
    if (person.password !== inputHash) {
        return Response.json({ success: false, msg: "舊密碼錯誤" }, { status: 400, headers: corsHeaders });
    }

    // 更新密碼
    const newHash = await hashPassword(newPassword, env.PASSWORD_SALT);
    await getDB().prepare(`
        UPDATE People SET password = ?, must_change_password = 0 WHERE id = ?
    `).bind(newHash, userId).run();

    // 更新 KV session 裡的 must_change_password
    await env.RUNBIKE_KV.put(
        `SESSION_${token}`,
        JSON.stringify({ ...sessionData, must_change_password: 0 }),
        { expirationTtl: 31536000 }
    );

    return Response.json({ success: true, msg: "密碼修改成功" }, { headers: corsHeaders });
}

    return null; // Passthrough if not matched
};
