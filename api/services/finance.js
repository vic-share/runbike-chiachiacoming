const TEAM_ID = 1;

export async function logFinance(db, { peopleId, type, amountCash, amountTicket, ticketType, note, sessionId }) {
    try {
        await db.prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note, related_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, peopleId, type, amountCash || 0, amountTicket || 0, ticketType || null, note || '', sessionId || null).run();
    } catch (e) { console.error("Log Finance Error:", e); }
}

export async function deductTickets(db, peopleId, type, amount, allowOverdraft = false, sessionName = "") {
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

export async function refundTickets(db, peopleId, type, amount, reason = "") {
    if (amount <= 0) return;
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 90);
    const expiryStr = expiry.toISOString().split('T')[0];
    await db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).bind(TEAM_ID, peopleId, type, amount, amount, expiryStr).run();
    await logFinance(db, { peopleId, type: 'REFUND', amountTicket: amount, ticketType: type, note: `課程退票: ${reason}` });
}