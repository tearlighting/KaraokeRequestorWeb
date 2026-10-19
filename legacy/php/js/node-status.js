/* Infrastructure status only. Legacy business calls and identity stay unchanged. */
(() => {
    'use strict';
    if (document.getElementById('node-api-status')) return;
    const status = document.createElement('small');
    status.id = 'node-api-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Node API: 接続確認中';
    status.style.cssText = 'display:block;text-align:right;padding:4px 12px;font-size:12px;opacity:.8';
    document.body.append(status);
    fetch('/api/v1/meta/health', {
        credentials: 'omit', signal: AbortSignal.timeout(5000),
        headers: { 'X-Yukari-Client': '1' },
    }).then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (body.ok !== true || body.data?.service !== 'yukari-api') throw new Error('Invalid health response');
        status.textContent = 'Node API: 接続済み（旧業務は PHP）';
        status.dataset.state = 'connected';
    }).catch(() => {
        status.textContent = 'Node API: 接続できません（旧 PHP は引き続き利用できます）';
        status.dataset.state = 'unavailable';
    });
})();
