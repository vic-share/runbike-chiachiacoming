import { sendPushToRole, sendPushToParticipants, createNotificationForRole } from '../services/push.js';
import { enrollDefaultStudents } from '../services/course.js';

const TEAM_ID = 1;

export const handleScheduled = async (event, env, ctx) => {
    const getDB = () => env.RUNBIKE_DB;
    const templates = (await env.RUNBIKE_KV.get("PUSH_TEMPLATES", { type: "json" })) || {};
    if (templates.is_enabled === false) return;

    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const beijingTime = new Date(utc + (3600000 * 8));
    const currentHour = beijingTime.getHours();
    
    const todayStr = beijingTime.toISOString().split('T')[0];
    const tomorrow = new Date(beijingTime); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const nextWeek = new Date(beijingTime); nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const queryRaceInfo = `SELECT RE.*, RS.series_name FROM RaceEvents RE LEFT JOIN RaceSeries RS ON RE.series_id = RS.id WHERE RE.team_id = ${TEAM_ID} AND RE.date = ?`;

    if (currentHour >= 8 && currentHour < 10) { 
        const { results: racesToday } = await getDB().prepare(queryRaceInfo).bind(todayStr).all();
        for (const race of racesToday) {
            const title = templates.reminder_day_start_title || "🌞 賽事提醒 (今天)";
            const bodyTpl = templates.reminder_day_start_body || "今天就是 {name} 比賽日，加油！";
            const body = bodyTpl.replace(/{name}/g, race.name).replace(/{date}/g, race.date).replace(/{location}/g, race.location || '比賽會場').replace(/{race_group}/g, race.series_name || '公開賽');
            await sendPushToParticipants(env, race.id, 'race', title, body, '/?page=races');
        }
    }

    if (currentHour === 23) {
        const { results: racesTmw } = await getDB().prepare(queryRaceInfo).bind(tomorrowStr).all();
        for (const race of racesTmw) {
            const title = templates.reminder_day_before_title || "📅 賽事提醒 (明天)";
            const bodyTpl = templates.reminder_day_before_body || "明天有比賽：{name}，請準時出席！";
            const body = bodyTpl.replace(/{name}/g, race.name).replace(/{date}/g, race.date).replace(/{location}/g, race.location || '比賽會場').replace(/{race_group}/g, race.series_name || '公開賽');
            await sendPushToParticipants(env, race.id, 'race', title, body, '/?page=races');
        }

        const { results: racesToday } = await getDB().prepare(queryRaceInfo).bind(todayStr).all();
        for (const race of racesToday) {
            const title = templates.reminder_day_end_title || "🏁 賽事結束";
            const bodyTpl = templates.reminder_day_end_body || "{name} 圓滿結束，快去更新成績吧！";
            const body = bodyTpl.replace(/{name}/g, race.name).replace(/{date}/g, race.date).replace(/{location}/g, race.location || '比賽會場').replace(/{race_group}/g, race.series_name || '公開賽');
            await sendPushToParticipants(env, race.id, 'race', title, body, '/?page=races');
        }

        const { results: newRecords } = await getDB().prepare(`
            SELECT TR.people_id, TR.training_type_id, TR.score, P.name, TT.type_name
            FROM TrainingRecords TR
            JOIN People P ON TR.people_id = P.id
            JOIN TrainingTypes TT ON TR.training_type_id = TT.id
            WHERE TR.date = ? AND TR.team_id = ${TEAM_ID}
        `).bind(todayStr).all();

        let brokenRecords = [];
        for (const rec of newRecords) {
            const best = await getDB().prepare(`
                SELECT MIN(score) as val FROM TrainingRecords 
                WHERE people_id = ? AND training_type_id = ? AND team_id = ${TEAM_ID} AND date < ?
            `).bind(rec.people_id, rec.training_type_id, todayStr).first();
            
            if (!best.val || parseFloat(rec.score) < parseFloat(best.val)) {
                brokenRecords.push(`${rec.name} (${rec.type_name} ${rec.score}s)`);
            }
        }

        if (brokenRecords.length > 0) {
            const uniqueNames = [...new Set(brokenRecords)];
            const title = templates.new_record_title || "⚡️ 破紀錄通知";
            const bodyTpl = templates.new_record_body || "賀！今日有 {count} 位選手創下新紀錄！";
            let body = "";
            if (bodyTpl.includes('{name}')) {
                body = `賀！今日破紀錄選手：${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? '...' : ''}`;
            } else {
                body = bodyTpl.replace('{count}', uniqueNames.length);
            }
            await sendPushToRole(env, 'all', title, body, '/?page=training');
            await createNotificationForRole(getDB(), 'all', title, '/?page=training');
        }

        const courseSystemStatus = await env.RUNBIKE_KV.get("COURSE_SYSTEM_STATUS", { type: "json" });
        if (!courseSystemStatus || courseSystemStatus.enabled) {
            const nextWeekDay = nextWeek.getDay();
            const { results: dueTemplates } = await getDB().prepare(`SELECT * FROM CourseTemplates WHERE day_of_week = ? AND is_auto_scheduled = 1 AND team_id = ${TEAM_ID}`).bind(nextWeekDay).all();
            
            let createdCourses = [];
            for (const tpl of dueTemplates) {
                const exists = await getDB().prepare(`SELECT id FROM ClassSessions WHERE date = ? AND start_time = ? AND name = ? AND team_id = ${TEAM_ID}`).bind(nextWeekStr, tpl.start_time, tpl.name).first();
                if (!exists) {
                    const res = await getDB().prepare(`
                        INSERT INTO ClassSessions (team_id, template_id, date, start_time, end_time, name, location, max_students, ticket_type, status, price, category)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, 'ROUTINE')
                    `).bind(TEAM_ID, tpl.id, nextWeekStr, tpl.start_time, tpl.end_time, tpl.name, tpl.location, tpl.max_students || 20, tpl.ticket_type || 'REGULAR', tpl.price || 0).run();
                    
                    await enrollDefaultStudents(getDB(), res.meta.last_row_id, tpl.id);
                    createdCourses.push(tpl.name);
                }
            }

            if (createdCourses.length > 0) {
                const title = "🆕 新課程開放報名"; 
                const body = `下週 (${nextWeekStr}) 新增了 ${createdCourses.length} 堂例行課程，快去報名吧！`;
                await sendPushToRole(env, 'all', title, body, '/?page=courses');
                await createNotificationForRole(getDB(), 'all', title, '/?page=courses');
            }
        }
    }
};