export const handleTraining = async ({ request, env, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    if (path === "/api/training-records") {
        if (method === "GET") { 
            // ✅ 分頁：預設 5000 筆，支援前端傳入 limit / offset
            const limit = parseInt(url.searchParams.get('limit')) || 5000;
            const offset = parseInt(url.searchParams.get('offset')) || 0;
            const { results } = await getDB().prepare(`SELECT R.id, R.date, R.people_id, R.training_type_id, R.score as value, R.note, T.type_name as name, P.name as person_name, R.created_at, R.client_id FROM TrainingRecords R JOIN TrainingTypes T ON R.training_type_id = T.id JOIN People P ON R.people_id = P.id WHERE R.team_id = ${TEAM_ID} ORDER BY R.date DESC, R.created_at DESC, R.id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all(); 
            return Response.json(results, { headers: corsHeaders }); 
        }
        if (method === "POST") {
            const { people_id, training_type_id, date, value, score, note, client_id, created_at } = await request.json();
            
            // ✅ 冪等性防重複檢查 (PWA 離線上傳必備功能)
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