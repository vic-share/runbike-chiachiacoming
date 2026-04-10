export const handleTraining = async ({ request, env, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    if (path === "/api/training-records") {
        if (method === "GET") { 
            // 接收前端傳來的參數
            const limitDates = parseInt(url.searchParams.get('limit_dates')) || 10;
            const offsetDates = parseInt(url.searchParams.get('offset_dates')) || 0;
            const peopleId = url.searchParams.get('people_id') || '';
            const typeId = url.searchParams.get('training_type_id') || '';
            const startDate = url.searchParams.get('start_date') || '';
            const endDate = url.searchParams.get('end_date') || '';

            // 1. 建立尋找「目標日期」的過濾條件
            let dateWhere = `WHERE team_id = ?`;
            const dateParams = [TEAM_ID];
            if (peopleId) { dateWhere += ` AND people_id = ?`; dateParams.push(peopleId); }
            if (typeId) { dateWhere += ` AND training_type_id = ?`; dateParams.push(typeId); }
            if (startDate) { dateWhere += ` AND date >= ?`; dateParams.push(startDate); }
            if (endDate) { dateWhere += ` AND date <= ?`; dateParams.push(endDate); }

            // 2. 利用 CTE (Common Table Expression) 先找出符合條件的 10 個日子，再把這 10 天的詳細數據全部 JOIN 出來
            let sql = `
                WITH TargetDates AS (
                    SELECT DISTINCT date FROM TrainingRecords
                    ${dateWhere}
                    ORDER BY date DESC LIMIT ? OFFSET ?
                )
                SELECT R.id, R.date, R.people_id, R.training_type_id, R.score as value, R.note, T.type_name as name, P.name as person_name, R.created_at, R.client_id
                FROM TrainingRecords R
                JOIN TrainingTypes T ON R.training_type_id = T.id
                JOIN People P ON R.people_id = P.id
                JOIN TargetDates TD ON R.date = TD.date
                WHERE R.team_id = ?
            `;
            
            // 組合最終參數
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
        if (method === "GET") return Response.json((await getDB().prepare(`SELECT * FROM TrainingTypes WHERE team_id = ${TEAM_ID}`).all()).results, { headers: corsHeaders });
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