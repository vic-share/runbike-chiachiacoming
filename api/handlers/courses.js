import { sendPushToRole, sendPushToParticipants, createNotificationForRole } from '../services/push.js';
import { deductTickets, refundTickets } from '../services/finance.js';
import { enrollDefaultStudents } from '../services/course.js';

export const handleCourses = async ({ request, env, ctx, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    if (path === "/api/courses/weekly") {
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        let query = `SELECT * FROM ClassSessions WHERE team_id = ${TEAM_ID}`;
        const params = [];
        if (start) { query += ` AND date >= ?`; params.push(start); } else { query += ` AND date >= date('now', '-3 days')`; }
        if (end) { query += ` AND date <= ?`; params.push(end); }
        query += ` ORDER BY date ASC, start_time ASC`;

        const { results: sessions } = await getDB().prepare(query).bind(...params).all();
        if (sessions.length === 0) return Response.json([], { headers: corsHeaders });

        const sessionIds = sessions.map(s => s.id);
        const { results: allEnrollments } = await getDB().prepare(`
            SELECT E.session_id, E.people_id as id, P.name, P.avatar_url as s_url, P.roles, E.status, E.note 
            FROM Enrollments E 
            JOIN People P ON E.people_id = P.id 
            WHERE E.session_id IN (${sessionIds.join(',')}) AND P.team_id = ${TEAM_ID}
        `).all();

        const enrollmentsMap = {};
        allEnrollments.forEach(e => {
            if (!enrollmentsMap[e.session_id]) enrollmentsMap[e.session_id] = [];
            enrollmentsMap[e.session_id].push({ ...e, roles: JSON.parse(e.roles || '[]') });
        });

        const enhanced = sessions.map(s => {
            const students = enrollmentsMap[s.id] || [];
            const enrolledCount = students.filter(st => st.status !== 'CANCELLED').length;
            return { 
                ...s, enrolled_count: enrolledCount, students: students, 
                capacity: s.max_students || 20, category: s.template_id ? (s.category || 'ROUTINE') : 'SPECIAL', 
                ticket_type: s.ticket_type || 'REGULAR', price: s.price || 0, note: s.note || '' 
            };
        });
        return Response.json(enhanced, { headers: corsHeaders });
    }

    if (path === "/api/courses/templates") {
        if (method === "GET") {
            const { results } = await getDB().prepare(`SELECT * FROM CourseTemplates WHERE team_id = ${TEAM_ID}`).all();
            return Response.json(results, { headers: corsHeaders });
        }
        if (method === "POST") {
            const body = await request.json();
            const name = body.name || ''; const day_of_week = body.day_of_week ?? 1; const start_time = body.start_time || '00:00'; const end_time = body.end_time || '00:00';
            const location = body.location || ''; const price = body.price || 0; const max_students = body.max_students || 20; const ticket_type = body.ticket_type || 'REGULAR';
            const default_student_ids = JSON.stringify(body.default_student_ids || []); const is_auto_scheduled = body.is_auto_scheduled ? 1 : 0;

            if (body.id) {
                await getDB().prepare(`UPDATE CourseTemplates SET name=?, day_of_week=?, start_time=?, end_time=?, location=?, price=?, max_students=?, ticket_type=?, default_student_ids=?, is_auto_scheduled=? WHERE id=?`).bind(name, day_of_week, start_time, end_time, location, price, max_students, ticket_type, default_student_ids, is_auto_scheduled, body.id).run();
            } else {
                await getDB().prepare(`INSERT INTO CourseTemplates (team_id, name, day_of_week, start_time, end_time, location, price, max_students, ticket_type, default_student_ids, is_auto_scheduled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, name, day_of_week, start_time, end_time, location, price, max_students, ticket_type, default_student_ids, is_auto_scheduled).run();
            }
            return Response.json({ success: true }, { headers: corsHeaders });
        }
        if (method === "DELETE") {
            await getDB().prepare(`DELETE FROM CourseTemplates WHERE id=?`).bind(url.searchParams.get('id')).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/courses/sessions") {
        if (method === "POST") {
            const { id, date, start_time, end_time, name, location, capacity, max_students, category, ticket_type, template_id, price, note } = await request.json();
            const finalCategory = category || (template_id ? 'ROUTINE' : 'SPECIAL');
            
            if (!id) { 
                const res = await getDB().prepare(`INSERT INTO ClassSessions (team_id, template_id, date, start_time, end_time, name, location, max_students, ticket_type, status, category, price, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`).bind(TEAM_ID, template_id || null, date, start_time, end_time, name, location || '', max_students || capacity || 20, ticket_type || 'NONE', finalCategory, price || 0, note || '').run();
                await enrollDefaultStudents(getDB(), res.meta.last_row_id, template_id);
                
                ctx.waitUntil((async () => {
                    if (finalCategory === 'ROUTINE') {
                        const title = "🆕 新課程開放報名";
                        const body = `新增課程：${name} (${date})，快去報名吧！`;
                        await sendPushToRole(env, 'all', title, body, '/?page=courses');
                        await createNotificationForRole(getDB(), 'all', title, '/?page=courses');
                    }
                })());
                return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
            }
            await getDB().prepare(`UPDATE ClassSessions SET date=?, start_time=?, end_time=?, name=?, location=?, max_students=?, ticket_type=?, price=?, category=?, note=? WHERE id=? AND team_id=?`).bind(date, start_time, end_time, name, location || '', max_students || capacity || 20, ticket_type || 'NONE', price || 0, finalCategory, note || '', id, TEAM_ID).run();
            return Response.json({ success: true, id }, { headers: corsHeaders });
        }
        if (method === "DELETE") {
            const id = url.searchParams.get('id');
            await getDB().prepare("DELETE FROM ClassSessions WHERE id = ?").bind(id).run();
            await getDB().prepare("DELETE FROM Enrollments WHERE session_id = ?").bind(id).run();
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/courses/session-status" && method === "POST") {
        const { session_id, status } = await request.json(); 
        const session = await getDB().prepare("SELECT status, ticket_type, name, date FROM ClassSessions WHERE id = ? AND team_id = ?").bind(session_id, TEAM_ID).first();
        if (!session) return Response.json({ success: false }, { headers: corsHeaders });

        await getDB().prepare("UPDATE ClassSessions SET status = ? WHERE id = ? AND team_id = ?").bind(status, session_id, TEAM_ID).run();
        
        const { results: enrollments } = await getDB().prepare(`SELECT people_id FROM Enrollments WHERE session_id = ? AND status = 'ENROLLED'`).bind(session_id).all();
        if (session.ticket_type && session.ticket_type !== 'NONE') {
            if (status === 'CONFIRMED' && session.status !== 'CONFIRMED') {
                for (const p of enrollments) await deductTickets(getDB(), p.people_id, session.ticket_type, 1, true, session.name);
            } else if (status === 'CANCELLED' && session.status === 'CONFIRMED') {
                for (const p of enrollments) await refundTickets(getDB(), p.people_id, session.ticket_type, 1, '課程取消');
            }
        }

        ctx.waitUntil((async () => {
            const templates = (await env.RUNBIKE_KV.get("PUSH_TEMPLATES", { type: "json" })) || {};
            let title = "", bodyTpl = "";
            if (status === 'CONFIRMED') {
                title = templates.course_open_title || "✅ 確認開課通知";
                bodyTpl = templates.course_open_body || "課程 {name} 已確認開課，請準時出席！";
            } else if (status === 'CANCELLED') {
                title = templates.course_cancelled_title || "🚫 停課通知";
                bodyTpl = templates.course_cancelled_body || "課程 {name} 已取消，請確認行程。";
            }
            if (title) {
                const body = bodyTpl.replace(/{name}/g, session.name).replace(/{date}/g, session.date);
                await sendPushToParticipants(env, session_id, 'course', title, body, '/?page=courses');
            }
        })());
        return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (path === "/api/courses/join") { const { session_id, people_id } = await request.json(); const existing = await getDB().prepare("SELECT * FROM Enrollments WHERE session_id = ? AND people_id = ?").bind(session_id, people_id).first(); if(existing) await getDB().prepare("UPDATE Enrollments SET status = 'ENROLLED' WHERE id = ?").bind(existing.id).run(); else await getDB().prepare("INSERT INTO Enrollments (session_id, people_id, status) VALUES (?, ?, 'ENROLLED')").bind(session_id, people_id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }
    if (path === "/api/courses/exit") { const { session_id, people_id, reason } = await request.json(); await getDB().prepare("UPDATE Enrollments SET status = 'CANCELLED', note = ? WHERE session_id = ? AND people_id = ?").bind(reason, session_id, people_id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }

    return null;
};