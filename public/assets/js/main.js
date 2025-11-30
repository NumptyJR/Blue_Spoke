import { state } from './state.js';
import { apiRequest } from './api.js';
import { ensureShell, updateUserInfo, handleLogout } from './views/shell.js';
import { renderLogin } from './views/login.js';
import { notify } from './utils.js';
import { initOverview } from './views/overview.js';
import { initWorkOrders } from './views/workorders.js';
import { initCustomers } from './views/customers.js';
import { initInventory } from './views/inventory.js';
import { initScheduling } from './views/scheduling.js';
import { initWarranties } from './views/warranties.js';

export async function bootstrap() {
    ensureShell();

    // Initialize views
    initOverview();
    initWorkOrders();
    initCustomers();
    initInventory();
    initScheduling();
    initWarranties();

    try {
        const me = await apiRequest('/me');
        state.user = me.user;
        updateUserInfo();
    } catch (err) {
        notify(err.message, 'error');
        handleLogout(true);
    }
}

// Entry point
if (state.token) {
    bootstrap();
} else {
    renderLogin();
}
