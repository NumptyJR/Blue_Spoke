import { state } from '../state.js';
import { renderLogin } from './login.js';
import { notify, formatMinutes } from '../utils.js';
import { apiRequest } from '../api.js';


export function handleLogout(silent = false) {
    state.token = null;
    state.user = null;
    state.shellReady = false;
    localStorage.removeItem('blueSpokeToken');
    document.cookie = 'blue_spoke_token=; Max-Age=0; path=/; SameSite=Lax';
    if (!silent) notify('Signed out', 'info');
    renderLogin();
}

export function ensureShell() {
    if (state.shellReady) return;
    const root = document.getElementById('app');
    root.innerHTML = `
        <div class="app-shell">
            <aside class="sidebar">
                <div class="brand-stack">
                    <div class="brand">Blue Spoke</div>
                    <p class="muted">Service Console</p>
                </div>
                <div class="side-clock clock-control">
                    <div class="user-chip small">
                        <strong id="side-user-name">—</strong>
                        <button type="button" id="side-user-toggle" class="btn-ghost" title="Show roster">▾</button>
                    </div>
                    <span id="side-clock-chip" class="badge status-bad" title="Click to clock in/out">OUT</span>
                    <div id="side-clock-dropdown" class="clock-dropdown" hidden>
                        <h4>On shift</h4>
                        <ul id="side-roster-in"></ul>
                        <h4>Off shift</h4>
                        <ul id="side-roster-out"></ul>
                    </div>
                </div>
                <nav>
                    <button data-view="overview" class="active"><span class="nav-icon">🏠</span> Overview</button>
                    <button data-view="customers"><span class="nav-icon">👤</span> Customers</button>
                    <button data-view="inventory"><span class="nav-icon">📦</span> Inventory</button>
                    <button data-view="workorders"><span class="nav-icon">🗂️</span> Work Orders</button>
                    <button data-view="scheduling"><span class="nav-icon">📅</span> Scheduling</button>
                    <button data-view="warranties"><span class="nav-icon">🛡️</span> Warranties</button>
                </nav>
                <button id="logout-btn" class="btn-ghost">Sign out</button>
            </aside>
            <section class="main">
                <div class="content">
                    <section id="view-overview" class="view active"></section>
                    <section id="view-customers" class="view"></section>
                    <section id="view-inventory" class="view"></section>
                    <section id="view-workorders" class="view"></section>
                    <section id="view-scheduling" class="view"></section>
                    <section id="view-warranties" class="view"></section>
                </div>
            </section>
        </div>

        <!-- Clock PIN Modal -->
        <div class="modal" id="clock-pin-modal" hidden>
            <div class="modal-card" style="max-width: 320px;">
                <div class="modal-header">
                    <strong>Employee Code</strong>
                    <button type="button" class="btn-ghost" id="clock-pin-close">✕</button>
                </div>
                <div class="modal-body">
                    <form id="clock-pin-form">
                        <p class="muted" style="margin-top:0;">Enter your 4-digit code to clock in or out.</p>
                        <input type="password" name="pin" id="clock-pin-input" placeholder="0000" maxlength="4" style="font-size: 1.5rem; letter-spacing: 0.5em; text-align: center;" required>
                        <div class="form-actions full" style="margin-top: 1rem;">
                            <button class="btn-primary" type="submit" style="width:100%">Confirm</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;


    document.getElementById('logout-btn').addEventListener('click', () => handleLogout());

    const navButtons = document.querySelectorAll('.sidebar button[data-view]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            import('../router.js').then(m => m.setActiveView(btn.dataset.view));
        });
    });

    // Clock listeners
    document.getElementById('side-clock-chip').addEventListener('click', openClockModal);
    document.getElementById('side-user-toggle').addEventListener('click', () => {
        const dd = document.getElementById('side-clock-dropdown');
        dd.hidden = !dd.hidden;
    });

    // Clock Modal Listeners
    document.getElementById('clock-pin-close').addEventListener('click', closeClockModal);
    document.getElementById('clock-pin-form').addEventListener('submit', handleClockPinSubmit);

    state.shellReady = true;
    loadTimeClockStatus();
}

export function updateUserInfo() {
    if (!state.user) return;
    const { full_name: fullName = 'Unknown user' } = state.user;

    const sideUser = document.getElementById('side-user-name');
    if (sideUser) sideUser.textContent = fullName;

    updateTopClockStatus();
}

export async function loadTimeClockStatus() {
    try {
        const response = await apiRequest('/time-clock/status');
        const { people = [] } = response || {};
        state.timeClockStatus = Array.isArray(people) ? people : [];
        updateTopClockStatus();
    } catch (err) {
        // notify(`Time clock: ${err.message}`, 'error'); // Suppress initial load error if any
    }
}

function openClockModal() {
    const modal = document.getElementById('clock-pin-modal');
    const input = document.getElementById('clock-pin-input');
    modal.hidden = false;
    input.value = '';
    setTimeout(() => input.focus(), 100);
}

function closeClockModal() {
    document.getElementById('clock-pin-modal').hidden = true;
}

async function handleClockPinSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('clock-pin-input');
    const code = input.value;

    if (!code) return;
    if (!/^\d{4}$/.test(code.trim())) { notify('Enter a valid 4-digit code', 'error'); return; }
    const pin = code.trim();

    try {
        // Try to clock out first; if not clocked in, attempt to clock in
        try {
            await apiRequest('/time-clock/clock-out', { method: 'POST', body: { code: pin } });
            notify('Clocked out', 'success');
        } catch (e) {
            // If 409 not clocked in, try to clock in
            await apiRequest('/time-clock/clock-in', { method: 'POST', body: { code: pin } });
            notify('Clocked in', 'success');
        }
        closeClockModal();
        await loadTimeClockStatus();
    } catch (err) {
        notify(err.message || 'Clock action failed', 'error');
    }
}

function updateTopClockStatus() {
    const chip = document.getElementById('side-clock-chip');
    const inList = document.getElementById('side-roster-in');
    const outList = document.getElementById('side-roster-out');
    if (!chip) return;

    const me = state.user || {};
    const self = (state.timeClockStatus || []).find(p => Number(p.id) === Number(me.id));
    const isIn = self ? Boolean(self.is_clocked_in) : false;

    chip.textContent = isIn ? 'IN' : 'OUT';
    chip.classList.toggle('status-ok', isIn);
    chip.classList.toggle('status-bad', !isIn);

    // Roster dropdown
    if (inList && outList) {
        const on = (state.timeClockStatus || []).filter(p => p.is_clocked_in);
        const off = (state.timeClockStatus || []).filter(p => !p.is_clocked_in);

        inList.innerHTML = on.length ? on.map(p => {
            const dur = typeof p.minutes_active === 'number' ? formatMinutes(p.minutes_active) : '—';
            const role = p.role || '';
            return `<li class="roster-item"><span class="roster-dot in"></span><span>${p.full_name}</span><span class="roster-role">${role}</span><span class="roster-duration">${dur}</span></li>`;
        }).join('') : '<li class="muted">—</li>';

        outList.innerHTML = off.length ? off.map(p => {
            const role = p.role || '';
            return `<li class="roster-item"><span class="roster-dot out"></span><span>${p.full_name}</span><span class="roster-role">${role}</span></li>`;
        }).join('') : '<li class="muted">—</li>';
    }
}
