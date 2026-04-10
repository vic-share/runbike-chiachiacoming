import webpush from 'web-push';

const TEAM_ID = 1;

export async function sendPushToRole(env, role, title, body, url = "/") {
    if (!env.VAPID_PRIVATE_KEY) return 0;
    const getDB = () => env.RUNBIKE_DB;
    webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:admin@chiachia.com', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    
    let query = `SELECT * FROM PushSubscriptions WHERE people_id IN (SELECT id FROM People WHERE team_id = ${TEAM_ID}`;
    if (role !== 'all') {
        query += ` AND roles LIKE '%"${role}"%'`; 
    }
    query += ")";

    const { results } = await getDB().prepare(query).all();
    if (!results.length) return 0;
    
    const payload = JSON.stringify({ title, body, url });
    await Promise.all(results.map(sub => 
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload).catch(async err => { 
            if (err.statusCode === 410) await getDB().prepare("DELETE FROM PushSubscriptions WHERE id = ?").bind(sub.id).run(); 
        })
    ));
    return results.length;
}

export async function sendPushToUser(env, peopleId, title, body, url = "/") {
    if (!env.VAPID_PRIVATE_KEY || !peopleId) return 0;
    const getDB = () => env.RUNBIKE_DB;
    webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:admin@chiachia.com', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

    const { results } = await getDB().prepare(`SELECT * FROM PushSubscriptions WHERE people_id = ?`).bind(peopleId).all();
    if (!results.length) return 0;

    const payload = JSON.stringify({ title, body, url });
    await Promise.all(results.map(sub => 
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload).catch(async err => { 
            if (err.statusCode === 410) await getDB().prepare("DELETE FROM PushSubscriptions WHERE id = ?").bind(sub.id).run(); 
        })
    ));
    return results.length;
}

export async function sendPushToParticipants(env, entityId, type, title, body, url = "/") {
    const getDB = () => env.RUNBIKE_DB;
    let peopleIds = [];

    if (type === 'race') {
        const { results } = await getDB().prepare("SELECT people_id FROM RaceRecords WHERE event_id = ?").bind(entityId).all();
        peopleIds = results.map(r => r.people_id);
    } else if (type === 'course') {
        const { results } = await getDB().prepare("SELECT people_id FROM Enrollments WHERE session_id = ? AND status = 'ENROLLED'").bind(entityId).all();
        peopleIds = results.map(r => r.people_id);
    }

    if (peopleIds.length === 0) return;

    // Deduplicate
    const uniqueIds = [...new Set(peopleIds)];
    const dbStatements = [];
    for (const pid of uniqueIds) {
        dbStatements.push(
            getDB().prepare(
                `INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (1, ?, ?, ?)`
            ).bind(pid, title, url)
        );
    }

    if (dbStatements.length > 0) {
        try {
            await getDB().batch(dbStatements);
        } catch (dbError) {
            console.error("[DB Batch Error] 通知寫入失敗:", dbError);
        }
    }

    const pushPromises = uniqueIds.map(pid => 
        sendPushToUser(env, pid, title, body, url).catch(err => {
            console.error(`[Push Error] 發送給 User ${pid} 失敗:`, err);
        })
    );

    await Promise.all(pushPromises);
}

export async function createNotification(db, userId, title, actionLink) {
    try {
        await db.prepare(`INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (?, ?, ?, ?)`).bind(TEAM_ID, userId, title, actionLink).run();
    } catch (e) { console.error("Create Notification Error:", e); }
}

export async function createNotificationForRole(db, role, title, actionLink) {
    try {
        const query = role === 'all' ? `SELECT id FROM People WHERE team_id = ?` : `SELECT id FROM People WHERE team_id = ? AND roles LIKE ?`;
        const params = role === 'all' ? [TEAM_ID] : [TEAM_ID, `%"${role}"%`];
        const { results } = await db.prepare(query).bind(...params).all();
        
        const stmt = db.prepare(`INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (?, ?, ?, ?)`);
        const batch = results.map(p => stmt.bind(TEAM_ID, p.id, title, actionLink));
        if (batch.length > 0) await db.batch(batch);
    } catch (e) { console.error("Create Role Notification Error:", e); }
}