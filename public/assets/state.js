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

export const state = {
    token: normalizeToken(localStorage.getItem('blueSpokeToken') || readCookie('blue_spoke_token')),
    user: null,
    view: 'overview',
    shellReady: false,
    customers: [],
    customerQuery: { q: '', page: 1, size: 25 },
    selectedCustomerId: null,
    customerWarranties: [],
    inventory: [],
    inventoryQuery: { q: '', brand: '', page: 1, size: 25 },
    workOrders: [],
    workOrderQuery: { status: 'open,in_progress,awaiting_parts', page: 1, size: 25 },
    workOrderDetail: null,
    timeClockStatus: [],
    nextSlot: null,
    mechanicDay: [],
    mechanicDayMeta: null,
};

