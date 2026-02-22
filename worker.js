
import webpush from 'web-push';
import { Buffer } from 'node:buffer';

const TEAM_ID = 1; 

// --- Push Helpers ---

// Send to specific Role (e.g., 'RIDER', 'COACH', 'all')
async function sendPushToRole(env, role, title, body, url = "/") {
    if (!env.VAPID_PRIVATE_KEY) return 0;
    const getDB = () => env['db-runbike'];
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

// Send to specific Person ID
async function sendPushToUser(env, peopleId, title, body, url = "/") {
    if (!env.VAPID_PRIVATE_KEY || !peopleId) return 0;
    const getDB = () => env['db-runbike'];
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

// Send to Participants of a Race or Course
async function sendPushToParticipants(env, entityId, type, title, body, url = "/") {
    const getDB = () => env['db-runbike'];
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
    for (const pid of uniqueIds) {
        await sendPushToUser(env, pid, title, body, url);
        await createNotification(getDB(), pid, title, url);
    }
}

// Helper to create DB notification
async function createNotification(db, userId, title, actionLink) {
    try {
        await db.prepare(`INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (?, ?, ?, ?)`).bind(TEAM_ID, userId, title, actionLink).run();
    } catch (e) { console.error("Create Notification Error:", e); }
}

async function createNotificationForRole(db, role, title, actionLink) {
    try {
        const query = role === 'all' ? `SELECT id FROM People WHERE team_id = ?` : `SELECT id FROM People WHERE team_id = ? AND roles LIKE ?`;
        const params = role === 'all' ? [TEAM_ID] : [TEAM_ID, `%"${role}"%`];
        const { results } = await db.prepare(query).bind(...params).all();
        
        const stmt = db.prepare(`INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (?, ?, ?, ?)`);
        const batch = results.map(p => stmt.bind(TEAM_ID, p.id, title, actionLink));
        if (batch.length > 0) await db.batch(batch);
    } catch (e) { console.error("Create Role Notification Error:", e); }
}

// --- Financial Logic ---
async function logFinance(db, { peopleId, type, amountCash, amountTicket, ticketType, note, sessionId }) {
    try {
        await db.prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note, related_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, peopleId, type, amountCash || 0, amountTicket || 0, ticketType || null, note || '', sessionId || null).run();
    } catch (e) { console.error("Log Finance Error:", e); }
}

async function deductTickets(db, peopleId, type, amount, allowOverdraft = false, sessionName = "") {
    if (amount <= 0) return { success: true, overdraft: false };
    const { results: batches } = await db.prepare(`SELECT id, remaining_amount, expiry_date FROM TicketBatches WHERE people_id = ? AND ticket_type = ? AND remaining_amount > 0 AND expiry_date >= DATE('now') ORDER BY expiry_date ASC`).bind(peopleId, type).all();
    let toDeduct = amount;
    const updates = [];
    for (const batch of batches) {
        if (toDeduct <= 0) break;
        const taking = Math.min(batch.remaining_amount, toDeduct);
        updates.push(db.prepare("UPDATE TicketBatches SET remaining_amount = remaining_amount - ? WHERE id = ?").bind(taking, batch.id));
        toDeduct -= taking;
    }
    let isOverdraft = false;
    if (toDeduct > 0) {
        if (!allowOverdraft) throw new Error(`票卷餘額不足 (缺少 ${toDeduct} 張)`);
        updates.push(db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, 0, ?, '2099-12-31')`).bind(TEAM_ID, peopleId, type, -toDeduct));
        isOverdraft = true;
    }
    if (updates.length > 0) await db.batch(updates);
    await logFinance(db, { peopleId, type: 'SPEND', amountTicket: -amount, ticketType: type, note: `課程扣票: ${sessionName}` });
    return { success: true, overdraft: isOverdraft };
}

async function refundTickets(db, peopleId, type, amount, reason = "") {
    if (amount <= 0) return;
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 90);
    const expiryStr = expiry.toISOString().split('T')[0];
    await db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, peopleId, type, amount, amount, expiryStr).run();
    await logFinance(db, { peopleId, type: 'REFUND', amountTicket: amount, ticketType: type, note: `課程退票: ${reason}` });
}

// --- Helper: Enroll Default Students ---
async function enrollDefaultStudents(db, sessionId, templateId) {
    if (!templateId) return;
    try {
        const tpl = await db.prepare("SELECT default_student_ids FROM CourseTemplates WHERE id = ?").bind(templateId).first();
        if (tpl && tpl.default_student_ids) {
            const ids = JSON.parse(tpl.default_student_ids);
            if (Array.isArray(ids) && ids.length > 0) {
                const stmt = db.prepare("INSERT OR IGNORE INTO Enrollments (session_id, people_id, status) VALUES (?, ?, 'ENROLLED')");
                const batch = ids.map(pid => stmt.bind(sessionId, pid));
                await db.batch(batch);
                console.log(`[AutoEnroll] Enrolled ${ids.length} students for session ${sessionId}`);
            }
        }
    } catch (e) {
        console.error("Auto Enroll Error:", e);
    }
}

// --- Main Worker ---

export default {
  async scheduled(event, env, ctx) {
      const getDB = () => env['db-runbike'];
      const templates = (await env.CHIACHIACOMING_KV.get("PUSH_TEMPLATES", { type: "json" })) || {};
      if (templates.is_enabled === false) return; // Master Switch

      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const beijingTime = new Date(utc + (3600000 * 8));
      const currentHour = beijingTime.getHours();
      
      const todayStr = beijingTime.toISOString().split('T')[0];
      const tomorrow = new Date(beijingTime); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const nextWeek = new Date(beijingTime); nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      // Helper to fetch race info
      const queryRaceInfo = `SELECT RE.*, RS.series_name FROM RaceEvents RE LEFT JOIN RaceSeries RS ON RE.series_id = RS.id WHERE RE.team_id = ${TEAM_ID} AND RE.date = ?`;

      // ==========================================
      // 1-2: 08:00 Taipei (Morning Push)
      // ==========================================
      if (currentHour >= 8 && currentHour < 10) { 
          // Race Start (Today) -> Participants
          const { results: racesToday } = await getDB().prepare(queryRaceInfo).bind(todayStr).all();
          for (const race of racesToday) {
              const title = templates.reminder_day_start_title || "🌞 賽事提醒 (今天)";
              const bodyTpl = templates.reminder_day_start_body || "今天就是 {name} 比賽日，加油！";
              const body = bodyTpl.replace(/{name}/g, race.name).replace(/{date}/g, race.date).replace(/{location}/g, race.location || '比賽會場').replace(/{race_group}/g, race.series_name || '公開賽');
              await sendPushToParticipants(env, race.id, 'race', title, body, '/?page=races');
          }
      }

      // ==========================================
      // 23:00 Taipei (Night Push & Automation)
      // ==========================================
      if (currentHour === 23) {
          
          // 1-1: Race Reminder (Tomorrow) -> Participants
          const { results: racesTmw } = await getDB().prepare(queryRaceInfo).bind(tomorrowStr).all();
          for (const race of racesTmw) {
              const title = templates.reminder_day_before_title || "📅 賽事提醒 (明天)";
              const bodyTpl = templates.reminder_day_before_body || "明天有比賽：{name}，請準時出席！";
              const body = bodyTpl.replace(/{name}/g, race.name).replace(/{date}/g, race.date).replace(/{location}/g, race.location || '比賽會場').replace(/{race_group}/g, race.series_name || '公開賽');
              await sendPushToParticipants(env, race.id, 'race', title, body, '/?page=races');
          }

          // 1-3: Race End (Today) -> Participants
          const { results: racesToday } = await getDB().prepare(queryRaceInfo).bind(todayStr).all();
          for (const race of racesToday) {
              const title = templates.reminder_day_end_title || "🏁 賽事結束";
              const bodyTpl = templates.reminder_day_end_body || "{name} 圓滿結束，快去更新成績吧！";
              const body = bodyTpl.replace(/{name}/g, race.name).replace(/{date}/g, race.date).replace(/{location}/g, race.location || '比賽會場').replace(/{race_group}/g, race.series_name || '公開賽');
              await sendPushToParticipants(env, race.id, 'race', title, body, '/?page=races');
          }

          // 1-4: New Record Check (Today) -> All Riders
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

          // Auto-Create Course (Date + 7) -> Task 2-2: Push "New Course" (Routine)
          const courseSystemStatus = await env.CHIACHIACOMING_KV.get("COURSE_SYSTEM_STATUS", { type: "json" });
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
                      
                      // Auto Enroll Default Students
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
  },

  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Token, X-OTP",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const getDB = () => env['db-runbike'];

    try {
      // Lazy Init
      await getDB().prepare(`CREATE TABLE IF NOT EXISTS FinancialRecords (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER DEFAULT 1, people_id INTEGER, transaction_type TEXT, amount_cash INTEGER DEFAULT 0, amount_ticket INTEGER DEFAULT 0, ticket_type TEXT, note TEXT, related_session_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run();
      await getDB().prepare(`CREATE TABLE IF NOT EXISTS SystemNotifications (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER DEFAULT 1, user_id INTEGER, title TEXT, action_link TEXT, is_read BOOLEAN DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run();

      if (path === "/api/env.js") {
        const script = `window.ENV = window.ENV || {}; window.ENV.VITE_SUPABASE_URL = "${env.VITE_SUPABASE_URL || ''}"; window.ENV.VITE_SUPABASE_ANON_KEY = "${env.VITE_SUPABASE_ANON_KEY || ''}"; window.ENV.VAPID_PUBLIC_KEY = "${env.VAPID_PUBLIC_KEY || ''}";`;
        return new Response(script, { headers: { "Content-Type": "application/javascript", ...corsHeaders } });
      }

      // --- Lookup (Generic Update for People) ---
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
                  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(extras.password).trim())).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
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

      // --- People API ---
      if (path === "/api/people") {
          if (method === "GET") {
              return Response.json((await getDB().prepare(`SELECT id, team_id, name, role, roles, birthday, avatar_url as s_url, full_photo_url as b_url, bio as myword, is_retired as is_hidden, full_name FROM People WHERE team_id = ${TEAM_ID}`).all()).results, { headers: corsHeaders });
          }
          if (method === "POST") {
              const { name, full_name, role, birthday, roles } = await request.json();
              // Default password could be set or left null
              const res = await getDB().prepare("INSERT INTO People (team_id, name, full_name, role, birthday, roles) VALUES (?, ?, ?, ?, ?, ?)").bind(TEAM_ID, name, full_name, role || 'parent', birthday || null, JSON.stringify(roles || ['RIDER'])).run();
              return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
          }
      }

      // --- Notification APIs ---
      if (path === "/api/notifications/unread-count") {
          const userId = url.searchParams.get('user_id');
          if (!userId) return Response.json({ count: 0 }, { headers: corsHeaders });
          const result = await getDB().prepare("SELECT COUNT(*) as count FROM SystemNotifications WHERE user_id = ? AND is_read = 0 AND team_id = ?").bind(userId, TEAM_ID).first();
          return Response.json(result || { count: 0 }, { headers: corsHeaders });
      }
      if (path === "/api/notifications") {
          const userId = url.searchParams.get('user_id');
          const { results } = await getDB().prepare("SELECT * FROM SystemNotifications WHERE user_id = ? AND team_id = ? ORDER BY created_at DESC LIMIT 30").bind(userId, TEAM_ID).all();
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

      // --- Overview Data ---
      if (path === "/api/overview/legends") {
          const now = Math.floor(Date.now() / 1000);
          const { results } = await getDB().prepare(`
              SELECT P.name, P.avatar_url, RR.score as best_score, RE.name as type_name, RE.date, RR.ranking
              FROM RaceRecords RR
              JOIN People P ON RR.people_id = P.id
              JOIN RaceEvents RE ON RR.event_id = RE.id
              WHERE RR.team_id = ${TEAM_ID} AND RR.global_honor_expires_at > ?
              ORDER BY RR.global_honor_expires_at DESC
          `).bind(now).all();
          return Response.json(results, { headers: corsHeaders });
      }

      if (path === "/api/overview/forecast") {
          const { results } = await getDB().prepare(`
              SELECT id, name, date, location, series_id
              FROM RaceEvents
              WHERE team_id = ${TEAM_ID} AND date >= date('now')
              ORDER BY date ASC
              LIMIT 10
          `).all();
          return Response.json(results, { headers: corsHeaders });
      }

      // --- Settings: Course System Status ---
      if (path === "/api/settings/course-system") {
          if (method === "GET") {
              const status = await env.CHIACHIACOMING_KV.get("COURSE_SYSTEM_STATUS", { type: "json" });
              return Response.json(status || { enabled: true }, { headers: corsHeaders });
          }
          if (method === "POST") {
              const body = await request.json();
              await env.CHIACHIACOMING_KV.put("COURSE_SYSTEM_STATUS", JSON.stringify(body));
              return Response.json({ success: true }, { headers: corsHeaders });
          }
      }

      // --- Settings: Ticket Pricing ---
      if (path === "/api/settings/ticket-pricing") {
          if (method === "GET") {
              const pricing = await env.CHIACHIACOMING_KV.get("TICKET_PRICING", { type: "json" });
              const defaults = { regular_price: 400, racing_price: 700, group_practice_price: 150, special_tiers: [] };
              return Response.json(pricing || defaults, { headers: corsHeaders });
          }
          if (method === "POST") {
              const body = await request.json();
              await env.CHIACHIACOMING_KV.put("TICKET_PRICING", JSON.stringify(body));
              return Response.json({ success: true }, { headers: corsHeaders });
          }
      }

      // --- Settings: Push Templates ---
      if (path === "/api/settings/push-templates") {
          if (method === "GET") return Response.json(await env.CHIACHIACOMING_KV.get("PUSH_TEMPLATES", { type: "json" }) || {}, { headers: corsHeaders });
          if (method === "POST") { await env.CHIACHIACOMING_KV.put("PUSH_TEMPLATES", JSON.stringify(await request.json())); return Response.json({ success: true }, { headers: corsHeaders }); }
      }

      // --- Finance Report ---
      if (path === "/api/finance/report") {
          const month = url.searchParams.get('month'); // YYYY-MM format
          let whereClause = `WHERE team_id = ${TEAM_ID}`;
          const params = [];
          
          if (month) {
              whereClause += ` AND strftime('%Y-%m', created_at) = ?`;
              params.push(month);
          }

          const revenue = await getDB().prepare(`SELECT SUM(amount_cash) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT'`).bind(...params).first();
          const sold = await getDB().prepare(`SELECT SUM(amount_ticket) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT'`).bind(...params).first();
          const used = await getDB().prepare(`SELECT SUM(ABS(amount_ticket)) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'SPEND'`).bind(...params).first();

          return Response.json({
              total_revenue: revenue?.total || 0,
              tickets_sold: sold?.total || 0,
              tickets_used: used?.total || 0
          }, { headers: corsHeaders });
      }

      if (path === "/api/finance/history") {
          const pid = url.searchParams.get('people_id');
          let query = `SELECT * FROM FinancialRecords WHERE team_id = ${TEAM_ID}`;
          const params = [];
          if (pid) {
              query += ` AND people_id = ?`;
              params.push(pid);
          }
          query += ` ORDER BY created_at DESC LIMIT 100`;
          const { results } = await getDB().prepare(query).bind(...params).all();
          return Response.json(results, { headers: corsHeaders });
      }

      // --- Core Data APIs ---
      if (path === "/api/login" && method === "POST") {
        const { id, password } = await request.json();
        const person = await getDB().prepare(`SELECT id, team_id, name, role, roles, password, birthday, avatar_url as s_url, full_photo_url as b_url, bio as myword, is_retired as is_hidden, full_name, created_at FROM People WHERE id = ? AND team_id = ?`).bind(id, TEAM_ID).first();
        if (!person) return Response.json({ success: false, msg: "查無此人" }, { headers: corsHeaders });
        const inputHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(password || '').trim())).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
        const storedPass = person.password ? String(person.password) : null;
        if (!storedPass || inputHash !== storedPass) return Response.json({ success: false, msg: "密碼錯誤" }, { headers: corsHeaders });
        const token = crypto.randomUUID();
        await env.CHIACHIACOMING_KV.put(`SESSION_${token}`, JSON.stringify(person), { expirationTtl: 31536000 });
        return Response.json({ success: true, user: person, token }, { headers: corsHeaders });
      }

      if (path === "/api/race-events" && method === "POST") {
          const { id, name, date, location, series_id, url: eventUrl } = await request.json();
          if (id) {
              await getDB().prepare("UPDATE RaceEvents SET name = ?, date = ?, location = ?, series_id = ?, public_url = ? WHERE id = ? AND team_id = ?").bind(name, date, location || '', series_id || null, eventUrl || null, id, TEAM_ID).run();
          } else {
              await getDB().prepare("INSERT INTO RaceEvents (team_id, name, date, location, series_id, public_url) VALUES (?, ?, ?, ?, ?, ?)").bind(TEAM_ID, name, date, location || '', series_id || null, eventUrl || null).run();
              const templates = (await env.CHIACHIACOMING_KV.get("PUSH_TEMPLATES", { type: "json" })) || {};
              if (templates.is_enabled !== false) {
                  const title = templates.new_race_title || "🏆 新增賽事公告";
                  const bodyTpl = templates.new_race_body || "新增賽事：{name}，日期 {date}";
                  const body = bodyTpl.replace(/{name}/g, name).replace(/{date}/g, date);
                  await sendPushToRole(env, 'all', title, body, '/?page=races');
                  await createNotificationForRole(getDB(), 'all', title, '/?page=races');
              }
          }
          return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === "/api/courses/sessions" && method === "POST") {
          const { id, date, start_time, end_time, name, location, capacity, max_students, category, ticket_type, template_id, price } = await request.json();
          const finalCategory = category || (template_id ? 'ROUTINE' : 'SPECIAL');
          
          if (!id) { 
              const res = await getDB().prepare(`INSERT INTO ClassSessions (team_id, template_id, date, start_time, end_time, name, location, max_students, ticket_type, status, category, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`).bind(TEAM_ID, template_id || null, date, start_time, end_time, name, location || '', max_students || capacity || 20, ticket_type || 'NONE', finalCategory, price || 0).run();
              await enrollDefaultStudents(getDB(), res.meta.last_row_id, template_id);
              if (finalCategory === 'ROUTINE') {
                  const title = "🆕 新課程開放報名";
                  const body = `新增課程：${name} (${date})，快去報名吧！`;
                  await sendPushToRole(env, 'all', title, body, '/?page=courses');
                  await createNotificationForRole(getDB(), 'all', title, '/?page=courses');
              }
              return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
          }
          await getDB().prepare(`UPDATE ClassSessions SET date=?, start_time=?, end_time=?, name=?, location=?, max_students=?, ticket_type=?, price=?, category=? WHERE id=? AND team_id=?`).bind(date, start_time, end_time, name, location || '', max_students || capacity || 20, ticket_type || 'NONE', price || 0, finalCategory, id, TEAM_ID).run();
          return Response.json({ success: true, id }, { headers: corsHeaders });
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

          const templates = (await env.CHIACHIACOMING_KV.get("PUSH_TEMPLATES", { type: "json" })) || {};
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
          return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === "/api/tickets/purchase" && method === "POST") {
          const { people_id, type, amount, last_5_digits, total_price } = await request.json();
          await getDB().prepare(`INSERT INTO TicketRequests (team_id, people_id, type, amount, last_5_digits, total_price) VALUES (?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, people_id, type, amount, last_5_digits, total_price || 0).run();
          const person = await getDB().prepare("SELECT name FROM People WHERE id = ?").bind(people_id).first();
          
          const title = "💰 選手儲值公告";
          const body = `選手 ${person?.name} 欲購買 ${amount} 張票卷 (${last_5_digits})。請至後台確認。`;
          await sendPushToRole(env, 'COACH', title, body, '/?page=settings&target=coach_requests');
          await createNotificationForRole(getDB(), 'COACH', `購票申請: ${person?.name}`, '/?page=settings&target=coach_requests');
          return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === "/api/tickets/add" && method === "POST") {
          const { people_id, type, amount, expiry_date, note, price_paid } = await request.json();
          const expiry = expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
          let remainingToAdd = parseInt(amount);
          
          if (remainingToAdd > 0) {
              const { results: debts } = await getDB().prepare(`SELECT id, remaining_amount FROM TicketBatches WHERE people_id = ? AND ticket_type = ? AND remaining_amount < 0 ORDER BY expiry_date ASC`).bind(people_id, type).all();
              for (const debt of debts) {
                  if (remainingToAdd <= 0) break;
                  const debtValue = Math.abs(debt.remaining_amount);
                  if (remainingToAdd >= debtValue) { await getDB().prepare("DELETE FROM TicketBatches WHERE id = ?").bind(debt.id).run(); remainingToAdd -= debtValue; } 
                  else { await getDB().prepare("UPDATE TicketBatches SET remaining_amount = remaining_amount + ? WHERE id = ?").bind(remainingToAdd, debt.id).run(); remainingToAdd = 0; }
              }
          }
          if (remainingToAdd > 0) {
              await getDB().prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, people_id, type, remainingToAdd, remainingToAdd, expiry).run(); 
          }
          await logFinance(getDB(), { peopleId: people_id, type: 'DEPOSIT', amountTicket: amount, amountCash: price_paid || 0, ticketType: type, note: note || '手動儲值' });

          const title = "✅ 儲值狀態：成功";
          const body = `您的 ${amount} 張票卷已入帳！`;
          await sendPushToUser(env, people_id, title, body, '/?page=settings&target=rider_history');
          await createNotification(getDB(), people_id, title, '/?page=settings&target=rider_history');

          return Response.json({ success: true }, { headers: corsHeaders });
      }
      
      if (path === "/api/tickets/requests" && method === "DELETE") {
          const id = url.searchParams.get('id');
          const reason = url.searchParams.get('reason') || ''; 
          
          const req = await getDB().prepare("SELECT * FROM TicketRequests WHERE id = ?").bind(id).first();
          await getDB().prepare("DELETE FROM TicketRequests WHERE id = ?").bind(id).run();
          
          if (req) {
              await getDB().prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note) VALUES (?, ?, 'REJECTED', 0, ?, ?, ?)`).bind(TEAM_ID, req.people_id, req.amount, req.type, `申請被拒: ${reason || '無原因'}`).run();

              const title = "❌ 儲值申請未通過";
              const body = reason ? `您的儲值申請已被退回，原因：${reason}` : "您的儲值申請已被取消，請聯繫教練。";
              await sendPushToUser(env, req.people_id, title, body, '/?page=settings&target=rider_history');
              await createNotification(getDB(), req.people_id, title, '/?page=settings&target=rider_history');
          }
          return Response.json({ success: true }, { headers: corsHeaders });
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

      if (path === "/api/tickets/wallets") { 
          const { results: batches } = await getDB().prepare(`SELECT B.id as batch_id, P.id as people_id, P.name as person_name, B.ticket_type, B.remaining_amount, B.expiry_date FROM People P JOIN TicketBatches B ON P.id = B.people_id WHERE P.team_id = ${TEAM_ID} AND (B.remaining_amount != 0) AND (B.expiry_date >= DATE('now') OR B.remaining_amount < 0) ORDER BY P.id, B.expiry_date ASC`).all(); 
          const grouped = {};
          batches.forEach(b => { if (!grouped[b.people_id]) grouped[b.people_id] = { people_id: b.people_id, person_name: b.person_name, regular_balance: 0, racing_balance: 0, batches: [] }; const g = grouped[b.people_id]; g.batches.push({ id: b.batch_id, type: b.ticket_type, amount: b.remaining_amount, expiry_date: b.expiry_date }); if (b.ticket_type === 'REGULAR') g.regular_balance += b.remaining_amount; if (b.ticket_type === 'RACING') g.racing_balance += b.remaining_amount; });
          return Response.json(Object.values(grouped), { headers: corsHeaders }); 
      }
      if (path === "/api/tickets/requests") { const { results } = await getDB().prepare(`SELECT TR.*, P.name as person_name FROM TicketRequests TR JOIN People P ON TR.people_id = P.id WHERE TR.team_id = ${TEAM_ID} ORDER BY TR.created_at DESC`).all(); return Response.json(results, { headers: corsHeaders }); }
      if (path === "/api/tickets/batch" && method === "PUT") { const { batch_id, amount, expiry_date } = await request.json(); await getDB().prepare(`UPDATE TicketBatches SET remaining_amount = ?, expiry_date = ? WHERE id = ?`).bind(amount, expiry_date, batch_id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }
      
      if (path === "/api/courses/weekly") {
           const start = url.searchParams.get('start');
           const end = url.searchParams.get('end');
           
           let query = `SELECT * FROM ClassSessions WHERE team_id = ${TEAM_ID}`;
           const params = [];
           
           if (start) {
               query += ` AND date >= ?`;
               params.push(start);
           } else {
               query += ` AND date >= date('now', '-3 days')`;
           }
           
           if (end) {
               query += ` AND date <= ?`;
               params.push(end);
           }
           
           query += ` ORDER BY date ASC, start_time ASC`;

           const { results: sessions } = await getDB().prepare(query).bind(...params).all();
           const enhanced = await Promise.all(sessions.map(async s => {
               const count = await getDB().prepare("SELECT COUNT(*) as c FROM Enrollments E JOIN People P ON E.people_id = P.id WHERE E.session_id = ? AND E.status != 'CANCELLED' AND P.team_id = ?").bind(s.id, TEAM_ID).first();
               const { results: students } = await getDB().prepare(`SELECT E.people_id as id, P.name, P.avatar_url as s_url, E.status, E.note FROM Enrollments E JOIN People P ON E.people_id = P.id WHERE E.session_id = ? AND P.team_id = ?`).bind(s.id, TEAM_ID).all();
               return { ...s, enrolled_count: count.c, students, capacity: s.max_students || 20, category: s.template_id ? (s.category || 'ROUTINE') : 'SPECIAL', ticket_type: s.ticket_type || 'REGULAR', price: s.price || 0 };
           }));
           return Response.json(enhanced, { headers: corsHeaders });
      }
      if (path === "/api/courses/templates") { if(method==="GET") return Response.json((await getDB().prepare(`SELECT * FROM CourseTemplates WHERE team_id = ${TEAM_ID}`).all()).results, { headers: corsHeaders }); if(method==="POST") { const body=await request.json(); if(body.id) await getDB().prepare(`UPDATE CourseTemplates SET name=?, day_of_week=?, start_time=?, end_time=?, location=?, price=?, max_students=?, ticket_type=?, default_student_ids=?, is_auto_scheduled=? WHERE id=?`).bind(body.name,body.day_of_week,body.start_time,body.end_time,body.location,body.price,body.max_students,body.ticket_type,JSON.stringify(body.default_student_ids),body.is_auto_scheduled?1:0,body.id).run(); else await getDB().prepare(`INSERT INTO CourseTemplates (team_id,name,day_of_week,start_time,end_time,location,price,max_students,ticket_type,default_student_ids,is_auto_scheduled) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(TEAM_ID,body.name,body.day_of_week,body.start_time,body.end_time,body.location,body.price,body.max_students,body.ticket_type,JSON.stringify(body.default_student_ids),body.is_auto_scheduled?1:0).run(); return Response.json({success:true},{headers:corsHeaders}); } if(method==="DELETE") { await getDB().prepare(`DELETE FROM CourseTemplates WHERE id=?`).bind(url.searchParams.get('id')).run(); return Response.json({success:true},{headers:corsHeaders}); } }
      if (path === "/api/courses/join") { const { session_id, people_id } = await request.json(); const existing = await getDB().prepare("SELECT * FROM Enrollments WHERE session_id = ? AND people_id = ?").bind(session_id, people_id).first(); if(existing) await getDB().prepare("UPDATE Enrollments SET status = 'ENROLLED' WHERE id = ?").bind(existing.id).run(); else await getDB().prepare("INSERT INTO Enrollments (session_id, people_id, status) VALUES (?, ?, 'ENROLLED')").bind(session_id, people_id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }
      if (path === "/api/courses/exit") { const { session_id, people_id, reason } = await request.json(); await getDB().prepare("UPDATE Enrollments SET status = 'CANCELLED', note = ? WHERE session_id = ? AND people_id = ?").bind(reason, session_id, people_id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }
      if (path === "/api/courses/sessions" && method === "DELETE") { const id = url.searchParams.get('id'); await getDB().prepare("DELETE FROM ClassSessions WHERE id = ?").bind(id).run(); await getDB().prepare("DELETE FROM Enrollments WHERE session_id = ?").bind(id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }

      if (path === "/api/admin/push" && method === "POST") { 
          const { title, body, url, target_role } = await request.json(); 
          const count = await sendPushToRole(env, target_role || 'all', title, body, url); 
          await createNotificationForRole(getDB(), target_role || 'all', title, url); 
          return Response.json({ success: true, sent_count: count }, { headers: corsHeaders }); 
      }
      if (path === "/api/subscribe" && method === "POST") { const sub = await request.json(); await getDB().prepare("DELETE FROM PushSubscriptions WHERE endpoint = ?").bind(sub.endpoint).run(); await getDB().prepare("INSERT INTO PushSubscriptions (endpoint, p256dh, auth, people_id) VALUES (?, ?, ?, ?)").bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.people_id).run(); return Response.json({ success: true }, { headers: corsHeaders }); }
      if (path === "/api/unsubscribe" && method === "POST") { const sub = await request.json(); await getDB().prepare("DELETE FROM PushSubscriptions WHERE endpoint = ?").bind(sub.endpoint).run(); return Response.json({ success: true }, { headers: corsHeaders }); }
      
      if (path === "/api/race-events" && method === "GET") { const events = await getDB().prepare(`SELECT id, team_id, series_id, date, name, location, public_url as url FROM RaceEvents WHERE team_id = ${TEAM_ID} ORDER BY date DESC`).all(); const participants = await getDB().prepare(`SELECT RR.id, RR.people_id, RR.event_id, RR.ranking as race_group, RR.score as value, RR.personal_url as photo_url, RR.note, RR.global_honor_expires_at, COALESCE(RR.is_personal_honor, 0) as is_personal_honor, P.name, P.avatar_url as s_url FROM RaceRecords RR JOIN People P ON RR.people_id = P.id WHERE P.team_id = ${TEAM_ID}`).all(); const results = events.results.map(e => ({ ...e, participants: participants.results.filter(p => p.event_id === e.id) })); return Response.json(results, { headers: corsHeaders }); }
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
      
      if (path === "/api/race-records" && method === "POST") { 
          const { event_id, people_id, value, race_group, note, photo_url, is_personal_honor } = await request.json(); 
          const safe_value = value || '';
          const safe_race_group = race_group || '';
          const safe_note = note || '';
          const safe_photo_url = (typeof photo_url !== 'undefined') ? photo_url : null;
          
          const existing = await getDB().prepare("SELECT * FROM RaceRecords WHERE event_id = ? AND people_id = ?").bind(event_id, people_id).first(); 
          let safe_is_personal_honor = 0;
          if (typeof is_personal_honor !== 'undefined') {
              safe_is_personal_honor = is_personal_honor ? 1 : 0;
          } else if (existing) {
              safe_is_personal_honor = existing.is_personal_honor;
          }

          if (existing) { 
              await getDB().prepare("UPDATE RaceRecords SET score = ?, ranking = ?, note = ?, personal_url = ?, is_personal_honor = ? WHERE event_id = ? AND people_id = ?")
                  .bind(safe_value, safe_race_group, safe_note, safe_photo_url || existing.personal_url, safe_is_personal_honor, event_id, people_id).run(); 
          } else { 
              await getDB().prepare("INSERT INTO RaceRecords (team_id, event_id, people_id, score, ranking, note, personal_url, is_personal_honor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                  .bind(TEAM_ID, event_id, people_id, safe_value, safe_race_group, safe_note, safe_photo_url, safe_is_personal_honor).run(); 
          } 
          return Response.json({ success: true }, { headers: corsHeaders }); 
      }

      if (path === "/api/race-records" && method === "DELETE") {
          const { event_id, people_id } = await request.json();
          await getDB().prepare("DELETE FROM RaceRecords WHERE event_id = ? AND people_id = ?").bind(event_id, people_id).run();
          return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === "/api/training-records") {
          if (method === "GET") { 
              const { results } = await getDB().prepare(`SELECT R.id, R.date, R.people_id, R.training_type_id, R.score as value, R.note, T.type_name as name, P.name as person_name FROM TrainingRecords R JOIN TrainingTypes T ON R.training_type_id = T.id JOIN People P ON R.people_id = P.id WHERE R.team_id = ${TEAM_ID} ORDER BY R.date DESC, R.id DESC LIMIT 300`).all(); 
              return Response.json(results, { headers: corsHeaders }); 
          }
          if (method === "POST") {
              const { people_id, training_type_id, date, value, score, note } = await request.json();
              await getDB().prepare("INSERT INTO TrainingRecords (team_id, people_id, training_type_id, date, score, note) VALUES (?, ?, ?, ?, ?, ?)").bind(TEAM_ID, people_id, training_type_id, date, value || score, note || '').run();
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
      
      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (e) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
  }
};
