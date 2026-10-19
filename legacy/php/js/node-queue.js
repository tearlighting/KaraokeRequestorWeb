/* Queue-only capability; no Node login, ambient Node cookie, or write API access. */
window.YukariNativeQueue = async function (limit, offset) {
    const fail = (message) => {
        let alert = document.getElementById('node-queue-error');
        if (!alert) {
            alert = document.createElement('p'); alert.id = 'node-queue-error';
            alert.setAttribute('role', 'alert'); alert.style.cssText = 'padding:12px;color:#a11';
            document.body.prepend(alert);
        }
        alert.textContent = message;
        throw new Error(message);
    };
    try {
        const grant = await fetch('/api/queue_ticket.php', { method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-Yukari-Client': '1' }, body: '{}', signal: AbortSignal.timeout(10000) });
        const identity = await grant.json();
        if (!grant.ok || !identity.ok || !identity.data?.ticket) return fail(identity.error || '旧ページの隊列認証に失敗しました');
        const response = await fetch(`/api/v1/legacy/queue?limit=${limit}&offset=${offset}`, {
            credentials: 'omit', headers: { 'X-Yukari-Client': '1', 'X-Yukari-Legacy-Queue': identity.data.ticket },
            signal: AbortSignal.timeout(10000),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) return fail(result.error?.message || '隊列を読み取れません');
        document.getElementById('node-queue-error')?.remove();
        return result.data;
    } catch (error) { return fail(error instanceof Error ? error.message : '隊列の接続に失敗しました'); }
};
