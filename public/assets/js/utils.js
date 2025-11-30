
export function readCookie(name) {
    return document.cookie.split(';').map(c => c.trim()).filter(Boolean).reduce((acc, pair) => {
        if (acc) return acc;
        const [k, ...rest] = pair.split('=');
        if (k === name) return decodeURIComponent(rest.join('='));
        return '';
    }, '') || null;
}

export function normalizeToken(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null;
    return trimmed;
}

export function formatMinutes(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const minutes = Math.max(0, Number(value));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

let toastRoot = null;

export function notify(message, type = 'info', timeout = 4200) {
    if (!toastRoot) {
        toastRoot = document.querySelector('.flash-stack');
        if (!toastRoot) {
            toastRoot = document.createElement('div');
            toastRoot.className = 'flash-stack';
            document.body.appendChild(toastRoot);
        }
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => el.remove(), 220);
    }, timeout);
}
