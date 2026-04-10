import { sendPushToRole, createNotificationForRole } from '../services/push.js';

export const handleRaces = async ({ request, env, ctx, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    // Overview Endpoints
    if (path === "/api/overview/legends") {
        const now = Math.floor(Date.now() / 1000);
        const { results } = await getDB().prepare(`SELECT P.name, P.avatar_url, RR.score as best_score, RE.name as type_name, RE.date, RR.ranking FROM RaceRecords RR JOIN People P ON RR.people_id = P.id JOIN RaceEvents RE ON RR.event_id = RE.id WHERE RR.team_id = ${TEAM_ID} AND RR.global_honor_expires_at > ? ORDER BY RR.global_honor_expires_at DESC`).bind(now).all();
        return Response.json(results, { headers: corsHeaders });
    }

    if (path === "/api/overview/forecast") {
        const { results } = await getDB().prepare(`SELECT id, name, date, location, series_id FROM RaceEvents WHERE team_id = ${TEAM_ID} AND date >= date('now') ORDER BY date ASC LIMIT 10`).all();
        return Response.json(results, { headers: corsHeaders });
    }

    if (path === "/api/race-events") {
        if (method === "GET") { 
            const limit = parseInt(url.searchParams.get('limit')) || 10;
            const offset = parseInt(url.searchParams.get('offset')) || 0;
            const seriesId = url.searchParams.get('series_id');
            const startDate = url.searchParams.get('start_date');
            const endDate = url.searchParams.get('end_date');
            const status = url.searchParams.get('status');
            const cutoffDate = url.searchParams.get('cutoff_date');
            const joinedUserId = url.searchParams.get('joined_user_id');

            let eventWhere = `WHERE team_id = ?`;
            const eventParams = [TEAM_ID];

            if (seriesId && seriesId !== 'all') { eventWhere += ` AND series_id = ?`; eventParams.push(seriesId); }
            if (startDate) { eventWhere += ` AND date >= ?`; eventParams.push(startDate); }
            if (endDate) { eventWhere += ` AND date <= ?`; eventParams.push(endDate); }

            if (status === 'open' && cutoffDate) { eventWhere += ` AND date > ?`; eventParams.push(cutoffDate); }
            else if (status === 'finished' && cutoffDate) { eventWhere += ` AND date <= ?`; eventParams.push(cutoffDate); }

            if (status === 'joined' && joinedUserId) {
                eventWhere += ` AND id IN (SELECT event_id FROM RaceRecords WHERE people_id = ?)`;
                eventParams.push(joinedUserId);
            }

            const events = await getDB().prepare(`SELECT id, team_id, series_id, date, name, location, public_url as url FROM RaceEvents ${eventWhere} ORDER BY date DESC LIMIT ? OFFSET ?`).bind(...eventParams, limit, offset).all(); 
            if (events.results.length === 0) return Response.json([], { headers: corsHeaders });

            const eventIds = events.results.map(e => e.id);
            const placeholders = eventIds.map(() => '?').join(',');

            const participants = await getDB().prepare(`SELECT RR.id, RR.people_id, RR.event_id, RR.ranking as race_group, RR.score as value, RR.personal_url as photo_url, RR.note, RR.global_honor_expires_at, COALESCE(RR.is_personal_honor, 0) as is_personal_honor, P.name, P.avatar_url as s_url FROM RaceRecords RR JOIN People P ON RR.people_id = P.id WHERE P.team_id = ? AND RR.event_id IN (${placeholders})`).bind(TEAM_ID, ...eventIds).all(); 
            const results = events.results.map(e => ({ ...e, participants: participants.results.filter(p => p.event_id === e.id) })); 
            return Response.json(results, { headers: corsHeaders }); 
        }
        if (method === "POST") {
            const { id, name, date, location, series_id, url: eventUrl } = await request.json();
            if (id) {
                await getDB().prepare("UPDATE RaceEvents SET name = ?, date = ?, location = ?, series_id = ?, public_url = ? WHERE id = ? AND team_id = ?").bind(name, date, location || '', series_id || null, eventUrl || null, id, TEAM_ID).run();
            } else {
                await getDB().prepare("INSERT INTO RaceEvents (team_id, name, date, location, series_id, public_url) VALUES (?, ?, ?, ?, ?, ?)").bind(TEAM_ID, name, date, location || '', series_id || null, eventUrl || null).run();
                ctx.waitUntil((async () => {
                    const templates = (await env.RUNBIKE_KV.get("PUSH_TEMPLATES", { type: "json" })) || {};
                    if (templates.is_enabled !== false) {
                        const title = templates.new_race_title || "🏆 新增賽事公告";
                        const bodyTpl = templates.new_race_body || "新增賽事：{name}，日期 {date}";
                        const body = bodyTpl.replace(/{name}/g, name).replace(/{date}/g, date);
                        await sendPushToRole(env, 'all', title, body, '/?page=races');
                        await createNotificationForRole(getDB(), 'all', title, '/?page=races');
                    }
                })());
            }
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/race-series") {
        if (method === "GET") return Response.json((await getDB().prepare(`SELECT * FROM RaceSeries WHERE team_id = ${TEAM_ID}`).all()).results, { headers: corsHeaders });
        if (method === "POST") {
            const { id, series_name } = await request.json();
            if (id) await getDB().prepare("UPDATE RaceSeries SET series_name = ? WHERE id = ? AND team_id = ?").bind(series_name, id, TEAM_ID).run();
            else await getDB().prepare("INSERT INTO RaceSeries (team_id, series_name) VALUES (?, ?)").bind(TEAM_ID, series_name).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
        if (method === "DELETE") {
            const id = url.searchParams.get('id');
            await getDB().prepare("DELETE FROM RaceSeries WHERE id = ? AND team_id = ?").bind(id, TEAM_ID).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/race-records") {
        if (method === "POST") { 
            const { event_id, people_id, value, race_group, note, photo_url, is_personal_honor } = await request.json(); 
            const safe_event_id = event_id || null; const safe_people_id = people_id || null; const safe_value = value || ''; const safe_race_group = race_group || ''; const safe_note = note || ''; const safe_photo_url = (typeof photo_url !== 'undefined') ? photo_url : null;
            const existing = await getDB().prepare("SELECT * FROM RaceRecords WHERE event_id = ? AND people_id = ?").bind(safe_event_id, safe_people_id).first(); 
            let safe_is_personal_honor = 0;
            if (typeof is_personal_honor !== 'undefined') { safe_is_personal_honor = is_personal_honor ? 1 : 0; } else if (existing) { safe_is_personal_honor = existing.is_personal_honor; }
            if (existing) { await getDB().prepare("UPDATE RaceRecords SET score = ?, ranking = ?, note = ?, personal_url = ?, is_personal_honor = ? WHERE event_id = ? AND people_id = ?").bind(safe_value, safe_race_group, safe_note, safe_photo_url || existing.personal_url, safe_is_personal_honor, safe_event_id, safe_people_id).run(); 
            } else { await getDB().prepare("INSERT INTO RaceRecords (team_id, event_id, people_id, score, ranking, note, personal_url, is_personal_honor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(TEAM_ID, safe_event_id, safe_people_id, safe_value, safe_race_group, safe_note, safe_photo_url, safe_is_personal_honor).run(); } 
            return Response.json({ success: true }, { headers: corsHeaders }); 
        }
        if (method === "DELETE") {
            const { event_id, people_id } = await request.json();
            await getDB().prepare("DELETE FROM RaceRecords WHERE event_id = ? AND people_id = ?").bind(event_id, people_id).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/race-records/global-honor" && method === "POST") {
        const { record_id, duration_minutes } = await request.json();
        let expiry = null;
        if (duration_minutes > 0) {
            expiry = Math.floor(Date.now() / 1000) + (duration_minutes * 60);
            const rec = await getDB().prepare(`SELECT P.name, RE.name as race_name FROM RaceRecords RR JOIN People P ON RR.people_id = P.id JOIN RaceEvents RE ON RR.event_id = RE.id WHERE RR.id = ?`).bind(record_id).first();
            if (rec) {
                const title = "🏆 榮譽榜更新";
                const body = `${rec.name} 在 ${rec.race_name} 的表現被釘選到榮譽榜了！`;
                await sendPushToRole(env, 'all', title, body, '/?page=dashboard');
                await createNotificationForRole(getDB(), 'all', title, '/?page=dashboard');
            }
        }
        await getDB().prepare("UPDATE RaceRecords SET global_honor_expires_at = ? WHERE id = ?").bind(expiry, record_id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
    }
    return null;
};