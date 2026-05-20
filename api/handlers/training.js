// api/handlers/training.js
// 🟢 移除原本報錯的 import，改用最純粹的陣列解析

export const handleTraining = async ({ request, env, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    // 1. 解析目前登入使用者的 roles (相容字串與陣列)
    const user = request.user || null;
    let userRoles = [];
    if (user && user.roles) {
        if (Array.isArray(user.roles)) {
            userRoles = user.roles;
        } else if (typeof user.roles === 'string') {
            try { userRoles = JSON.parse(user.roles); } catch (e) { userRoles = []; }
        }
    }

    // 2. 核心身分判斷：只要你是 DEV, COACH, AIDE, 或是符合 RACING 身分的選手，就能放行
    const canViewRacingStats = userRoles.some(role => 
        ['DEV', 'COACH', 'AIDE', 'RACING'].includes(role)
    );

    if (path === "/api/training-records") {
        if (method === "GET") { 
            // 🟢 安全防護：沒有前述 4 種身分的人（例如一般 RIDER），直接擋掉
            if (!canViewRacingStats) {
                return Response.json({ success: false, msg: "Permission denied" }, { status: 403, headers: corsHeaders });
            }

            // 接收前端傳來的參數
            const limitDates = parseInt(url.searchParams.get('limit_dates')) || 10;
            const offsetDates = parseInt(url.searchParams.get('offset_dates')) || 0;
            const peopleId = url.searchParams.get('people_id') || '';
            const typeId = url.searchParams.get('training_type_id') || '';
            const startDate = url.searchParams.get('start_date') || '';
            const endDate = url.searchParams.get('end_date') || '';

            // 3. 建立尋找「目標日期」的過濾條件：只尋找擁有 RACING 角色的選手的日子
            let dateWhere = `
                WHERE R.team_id = ? 
                AND EXISTS (
                    SELECT 1 FROM People PSub 
                    WHERE R.people_id = PSub.id 
                    AND (PSub.roles LIKE '%"RACING"%' OR PSub.roles LIKE '%RACING%')
                )
            `;
            const dateParams = [TEAM_ID];
            if (peopleId) { dateWhere += ` AND R.people_id = ?`; dateParams.push(peopleId); }
            if (typeId) { dateWhere += ` AND R.training_type_id = ?`; dateParams.push(typeId); }
            if (startDate) { dateWhere += ` AND R.date >= ?`; dateParams.push(startDate); }
            if (endDate) { dateWhere += ` AND R.date <= ?`; dateParams.push(endDate); }

            // 4. 利用 CTE 先找出符合條件的 10 個日子，JOIN 時再次確保只撈出有 RACING 身分的選手資料
            let sql = `
                WITH TargetDates AS (
                    SELECT DISTINCT R.date FROM TrainingRecords R
                    ${dateWhere}
                    ORDER BY R.date DESC LIMIT ? OFFSET ?
                )
                SELECT R.id, R.date, R.people_id, R.training_type_id, R.score as value, R.note, T.type_name as name, P.name as person_name, R.created_at, R.client_id
                FROM TrainingRecords R
                JOIN TrainingTypes T ON R.training_type_id = T.id
                JOIN People P ON R.people_id = P.id
                JOIN TargetDates TD ON R.date = TD.date
                WHERE R.team_id = ?
                AND (P.roles LIKE '%"RACING"%' OR P.roles LIKE '%RACING%')
            `;
            
            const finalParams = [...dateParams, limitDates, offsetDates, TEAM_ID];
            if (peopleId) { sql += ` AND R.people_id = ?`; finalParams.push(peopleId); }
            if (typeId) { sql += ` AND R.training_type_id = ?`; finalParams.push(typeId); }
            sql += ` ORDER BY R.date DESC, R.created_at DESC, R.id DESC`;

            const { results } = await getDB().prepare(sql).bind(...finalParams).all(); 
            return Response.json(results, { headers: corsHeaders }); 
        }
        
        if (method === "POST") {
            const { people_id, training_type_id, date, value, score, note, client_id, created_at } = await request.json();
            if (client_id) {
                const exists = await getDB().prepare("SELECT id FROM TrainingRecords WHERE client_id = ?").bind(client_id).first();
                if (exists) return Response.json({ success: true, msg: "Duplicate blocked" }, { headers: corsHeaders });
            }
            const finalCreatedAt = created_at || new Date().toISOString();
            await getDB().prepare("INSERT INTO TrainingRecords (team_id, people_id, training_type_id, date, score, note, client_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(TEAM_ID, people_id, training_type_id, date, value || score, note || '', client_id || null, finalCreatedAt).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
        if (method === "PUT") {
            const { id, score, date, training_type_id, note } = await request.json();
            await getDB().prepare("UPDATE TrainingRecords SET score = ?, date = ?, training_type_id = ?, note = ? WHERE id = ? AND team_id = ?").bind(score, date, training_type_id, note || '', id, TEAM_ID).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
        if (method === "DELETE") {
            const { id } = await request.json();
            await getDB().prepare("DELETE FROM TrainingRecords WHERE id = ? AND team_id = ?").bind(id, TEAM_ID).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/training-types") {
        if (method === "GET") {
            if (!canViewRacingStats) {
                return Response.json([], { headers: corsHeaders });
            }
            return Response.json((await getDB().prepare(`SELECT * FROM TrainingTypes WHERE team_id = ${TEAM_ID}`).all()).results, { headers: corsHeaders });
        }
        if (method === "POST") {
            const { id, type_name, is_default } = await request.json();
            if (id) await getDB().prepare("UPDATE TrainingTypes SET type_name = ?, is_default = ? WHERE id = ? AND team_id = ?").bind(type_name, is_default?1:0, id, TEAM_ID).run();
            else await getDB().prepare("INSERT INTO TrainingTypes (team_id, type_name, is_default) VALUES (?, ?, ?)").bind(TEAM_ID, type_name, is_default?1:0).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
        if (method === "DELETE") {
            const id = url.searchParams.get('id');
            await getDB().prepare("DELETE FROM TrainingTypes WHERE id = ? AND team_id = ?").bind(id, TEAM_ID).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }
    return null;
};