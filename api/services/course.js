export async function enrollDefaultStudents(db, sessionId, templateId) {
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