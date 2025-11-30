import { normalizeToken, readCookie } from './utils.js';

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

export const AUTH_DEV_COMPAT = (() => {
    try { return localStorage.getItem('authDevCompat') === '1'; } catch { return false; }
})();
