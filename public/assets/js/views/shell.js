// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: shell.js
// Description: Shell view

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
                    <button data-view="overview" class="active">
                        <span class="nav-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                        </span>
                        Overview
                    </button>
                    <button data-view="customers">
                        <span class="nav-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                        </span>
                        Customers
                    </button>
                    <button data-view="inventory">
                        <span class="nav-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                            </svg>
                        </span>
                        Inventory
                    </button>
                    <button data-view="workorders">
                        <span class="nav-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                            </svg>
                        </span>
                        Work Orders
                    </button>
                    <button data-view="scheduling">
                        <span class="nav-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                        </span>
                        Scheduling
                    </button>
                    <button data-view="warranties">
                        <span class="nav-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                        </span>
                        Warranties
                    </button>
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
