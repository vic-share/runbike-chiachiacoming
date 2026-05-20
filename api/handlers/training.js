import { hasPermission, PERMISSIONS } from '../utils/auth.js'; // 🟢 請確保引用路徑正確

export const handleTraining = async ({ request, env, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    // 🟢 0. 從 request 中嘗試取出驗證後的 user 物件 (假設您前面有 middleware 或驗證機制)
    // 如果您的架構 user 是掛在 request.user 或傳入的參數中，請在此做對應調整
    const user = request.user || null;

    if (path === "/api/training-records") {
        if (method === "GET") { 
            // 🟢 安全防護：如果使用者不具備 RACING_DATA_VIEW 權限 (Admin, Coach, Aide, Racing 以外的人)
            // 直接擋掉不給撈數據，確保一般 Rider 無法透過繞過前端網址來偷看
            if (!hasPermission(user, PERMISSIONS.RACING_DATA_VIEW)) {
                return Response.json({ success: false, msg: "Permission denied" }, { status: 403, headers: corsHeaders });
            }

            // 接收前端傳來的參數
            const limitDates = parseInt(url.searchParams.get('limit_dates')) || 10;
            const offsetDates = parseInt(url.searchParams.get('offset_dates')) || 0;
            const peopleId = url.searchParams.get('people_id') || '';
            const typeId = url.searchParams.get('training_type_id') || '';
            const startDate = url.searchParams.get('start_date') || '';
            const endDate = url.searchParams.get('end_date') || '';

            // 1. 建立尋找「目標日期」的過濾條件
            // 🟢 關鍵改動：在尋找哪些日子有訓練時，就必須限制「只尋找擁有 RACING 角色的選手」的日子
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

            // 2. 利用 CTE (Common Table Expression) 先找出符合條件的 10 個日子，再把這 10 天的詳細數據全部 JOIN 出來
            // 🟢 關鍵改動：在最終 JOIN 時，再次確保 P.roles 包含 RACING，確保非競速選手的資料絕對不會混進來
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
        if (method === "GET") {
            // 🟢 安全防護：獲取訓練項目類型同樣只允許有數據查看權的人存取
            if (!hasPermission(user, PERMISSIONS.RACING_DATA_VIEW)) {
                return Response.json([], { headers: corsHeaders }); // 無權限回傳空陣列，避免前端報錯
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