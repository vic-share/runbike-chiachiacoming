import { sendPushToRole, sendPushToUser, createNotification, createNotificationForRole } from '../services/push.js';
import { logFinance } from '../services/finance.js';

export const handleFinanceAndTickets = async ({ request, env, ctx, url, path, method, getDB, TEAM_ID, corsHeaders }) => {
    if (path === "/api/finance/report") {
        const range = url.searchParams.get('month');
        const yearParam = url.searchParams.get('year');
        let whereClause = `WHERE team_id = ${TEAM_ID}`;
        const params = [];
        let startDate = '';
        let endDate = '';
        
        if (yearParam) {
            startDate = `${yearParam}-01-01`; endDate = `${yearParam}-12-31`;
        } else if (range === '1W') {
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (range === '1M') {
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (range === '3M') {
            startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (range && range.startsWith('CUSTOM:')) {
            const parts = range.split(':');
            if (parts.length === 3) { startDate = parts[1]; endDate = parts[2]; }
        } else if (range && range.match(/^\d{4}-\d{2}$/)) {
            whereClause += ` AND strftime('%Y-%m', created_at) = ?`; params.push(range);
        } else if (range === 'ALL') {
        } else {
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
    
        if (startDate) { whereClause += ` AND date(created_at) >= ?`; params.push(startDate); }
        if (endDate) { whereClause += ` AND date(created_at) <= ?`; params.push(endDate); }

        const revenue = await getDB().prepare(`SELECT SUM(amount_cash) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT'`).bind(...params).first();
        const sold = await getDB().prepare(`SELECT SUM(amount_ticket) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT'`).bind(...params).first();
        const used = await getDB().prepare(`SELECT SUM(ABS(amount_ticket)) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'SPEND'`).bind(...params).first();
        const daily = await getDB().prepare(`SELECT date(created_at) as date, SUM(amount_cash) as amount, SUM(amount_ticket) as tickets FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT' GROUP BY date(created_at) ORDER BY date ASC`).bind(...params).all();

        const targetYear = yearParam ? parseInt(yearParam) : new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();
        const months = [];
        for (let m = 1; m <= 12; m++) months.push(`${targetYear}-${String(m).padStart(2, '0')}`);
        const yearStart = `${targetYear}-01-01`; const yearEnd = `${targetYear}-12-31`;
        
        const { results: monthlyData } = await getDB().prepare(`
            SELECT strftime('%Y-%m', datetime(created_at, '+8 hours')) as month, SUM(amount_cash) as revenue, SUM(amount_ticket) as sold 
            FROM FinancialRecords WHERE team_id = ${TEAM_ID} AND transaction_type = 'DEPOSIT' AND date(datetime(created_at, '+8 hours')) >= ? AND date(datetime(created_at, '+8 hours')) <= ?
            GROUP BY strftime('%Y-%m', datetime(created_at, '+8 hours'))
        `).bind(yearStart, yearEnd).all();

        const monthlyMap = new Map(monthlyData.map((m) => [m.month, m]));
        const monthly = months.map(m => monthlyMap.get(m) || { month: m, revenue: 0, sold: 0 });

        return Response.json({
            total_revenue: revenue?.total || 0, tickets_sold: sold?.total || 0, tickets_used: used?.total || 0, daily_stats: daily.results, monthly_stats: monthly
        }, { headers: corsHeaders });
    }

    if (path === "/api/finance/history") {
        const pid = url.searchParams.get('people_id');
        // ✅ 已包含 Limit / Offset
        const limit = parseInt(url.searchParams.get('limit')) || 500;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query = `SELECT * FROM FinancialRecords WHERE team_id = ${TEAM_ID}`;
        const params = [];
        if (pid) { query += ` AND people_id = ?`; params.push(pid); }
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const { results } = await getDB().prepare(query).bind(...params).all();
        return Response.json(results, { headers: corsHeaders });
    }

    if (path === "/api/tickets/wallets") { 
        const { results: batches } = await getDB().prepare(`SELECT B.id as batch_id, P.id as people_id, P.name as person_name, B.ticket_type, B.remaining_amount, B.expiry_date FROM People P JOIN TicketBatches B ON P.id = B.people_id WHERE P.team_id = ${TEAM_ID} AND (B.remaining_amount != 0) AND (B.expiry_date >= DATE('now') OR B.remaining_amount < 0) ORDER BY P.id, B.expiry_date ASC`).all(); 
        const grouped = {};
        batches.forEach(b => { if (!grouped[b.people_id]) grouped[b.people_id] = { people_id: b.people_id, person_name: b.person_name, regular_balance: 0, racing_balance: 0, batches: [] }; const g = grouped[b.people_id]; g.batches.push({ id: b.batch_id, type: b.ticket_type, amount: b.remaining_amount, expiry_date: b.expiry_date }); if (b.ticket_type === 'REGULAR') g.regular_balance += b.remaining_amount; if (b.ticket_type === 'RACING') g.racing_balance += b.remaining_amount; });
        return Response.json(Object.values(grouped), { headers: corsHeaders }); 
    }

    if (path === "/api/tickets/purchase" && method === "POST") {
        const { people_id, type, amount, last_5_digits, total_price } = await request.json();
        await getDB().prepare(`INSERT INTO TicketRequests (team_id, people_id, type, amount, last_5_digits, total_price) VALUES (?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, people_id, type, amount, last_5_digits, total_price || 0).run();
        
        ctx.waitUntil((async () => {
            const person = await getDB().prepare("SELECT name FROM People WHERE id = ?").bind(people_id).first();
            const title = "💰 選手儲值公告";
            const body = `選手 ${person?.name} 欲購買 ${amount} 張票卷 (${last_5_digits})。請至後台確認。`;
            await sendPushToRole(env, 'COACH', title, body, '/?page=settings&target=coach_requests');
            await createNotificationForRole(getDB(), 'COACH', `購票申請: ${person?.name}`, '/?page=settings&target=coach_requests');
        })());
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

        ctx.waitUntil((async () => {
            const title = "✅ 儲值狀態：成功";
            const body = `您的 ${amount} 張票卷已入帳！`;
            await sendPushToUser(env, people_id, title, body, '/?page=settings&target=rider_history');
            await createNotification(getDB(), people_id, title, '/?page=settings&target=rider_history');
        })());
        return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (path === "/api/tickets/manual-add" && method === "POST") {
        const { people_id, type, amount, expiry_date, price, note } = await request.json();
        const expiry = expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
        await getDB().prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, people_id, type, amount, amount, expiry).run();
        const transactionType = amount >= 0 ? 'DEPOSIT' : 'SPEND';
        const logAmount = Math.abs(amount);
        await getDB().prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, people_id, transactionType, price || 0, logAmount, type, note || '管理員手動調整').run();

        ctx.waitUntil((async () => {
            await createNotification(getDB(), people_id, `庫存調整: ${amount > 0 ? '+' : ''}${amount}張 (${type})`, '/?page=settings&target=rider_history');
        })());
        return Response.json({ success: true }, { headers: corsHeaders });
    }
    
    if (path === "/api/tickets/requests") {
        if (method === "GET") {
            const { results } = await getDB().prepare(`SELECT TR.*, P.name as person_name FROM TicketRequests TR JOIN People P ON TR.people_id = P.id WHERE TR.team_id = ${TEAM_ID} ORDER BY TR.created_at DESC`).all(); 
            return Response.json(results, { headers: corsHeaders });
        }
        if (method === "DELETE") {
            const id = url.searchParams.get('id');
            const reason = url.searchParams.get('reason') || ''; 
            const approved = url.searchParams.get('approved') === 'true';
            
            const req = await getDB().prepare("SELECT * FROM TicketRequests WHERE id = ?").bind(id).first();
            await getDB().prepare("DELETE FROM TicketRequests WHERE id = ?").bind(id).run();
            
            if (req && !approved) {
                await getDB().prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note) VALUES (?, ?, 'REJECTED', 0, ?, ?, ?)`).bind(TEAM_ID, req.people_id, req.amount, req.type, `申請被拒: ${reason || '無原因'}`).run();

                ctx.waitUntil((async () => {
                    const title = "❌ 儲值申請未通過";
                    const body = reason ? `您的儲值申請已被退回，原因：${reason}` : "您的儲值申請已被取消，請聯繫教練。";
                    await sendPushToUser(env, req.people_id, title, body, '/?page=settings&target=rider_history');
                    await createNotification(getDB(), req.people_id, title, '/?page=settings&target=rider_history');
                })());
            }
            return Response.json({ success: true }, { headers: corsHeaders });
        }
    }

    if (path === "/api/tickets/batch" && method === "PUT") { 
        const { batch_id, amount, expiry_date } = await request.json(); 
        await getDB().prepare(`UPDATE TicketBatches SET remaining_amount = ?, expiry_date = ? WHERE id = ?`).bind(amount, expiry_date, batch_id).run(); 
        return Response.json({ success: true }, { headers: corsHeaders }); 
    }

    return null;
};