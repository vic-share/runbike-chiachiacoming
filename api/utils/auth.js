export async function hashPassword(password, salt) {
    const text = String(password || '').trim() + (salt || '');
    return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(buf => 
        Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    );
}