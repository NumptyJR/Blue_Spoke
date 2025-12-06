// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: scheduling.js
// Description: Scheduling view

import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { notify } from '../utils.js';

export function initScheduling() {
    const container = document.getElementById('view-scheduling');
    container.innerHTML = `
        <div class="section-nav">
            <button class="nav-card" data-section="schedule-next">
                <span class="tile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                </span>
                Next slot finder
                <span>Locate bay availability</span>
            </button>
            <button class="nav-card" data-section="mechanic-day">
                <span class="tile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                </span>
                Mechanic day view
                <span>See a tech's lineup</span>
            </button>
            <button class="nav-card" data-section="appointment-create">
                <span class="tile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </span>
                Schedule appointment
                <span>Book service windows</span>
            </button>
        </div>
        <div class="section-panels">
            <article class="card section-panel active" id="schedule-next">
                <h2>Find the next slot</h2>
                <form id="schedule-next-form" class="two-col">
                    <label>Mechanic ID<input name="mechanic_id" type="number"></label>
                    <label>Location ID<input name="location_id" type="number"></label>
                    <label>Duration (minutes)<input name="duration_minutes" type="number" value="60"></label>
                    <label>From<input name="from" type="datetime-local"></label>
                    <div class="form-actions">
                        <button class="btn-primary" type="submit">Lookup</button>
                    </div>
                </form>
                <div id="next-slot-card" class="detail-block" style="margin-top:1rem;"></div>
            </article>
            <article class="card section-panel" id="mechanic-day">
                <h2>Mechanic day</h2>
                <form id="mechanic-day-form" class="two-col">
                    <label>Mechanic ID<input name="mechanic_id" type="number" required></label>
                    <label>Day<input name="day" type="date"></label>
                    <div class="form-actions">
                        <button class="btn-primary" type="submit">Load day</button>
                    </div>
                </form>
                <div id="mechanic-day-results" class="detail-block" style="margin-top:1rem;"></div>
            </article>
            <article class="card section-panel" id="appointment-create">
                <h2>Create appointment</h2>
                <form id="appointment-form" class="two-col">
                    <label>Work order ID<input name="work_order_id" type="number" required></label>
                    <label>Start at<input name="start_at" type="datetime-local" required></label>
                    <label>End at<input name="end_at" type="datetime-local" required></label>
                    <label>Assigned to<input name="assigned_to" type="number"></label>
                    <label>Location ID<input name="location_id" type="number"></label>
                    <label>Status<input name="status" value="scheduled"></label>
                    <label>Notes<textarea name="notes"></textarea></label>
                    <div class="form-actions">
                        <button class="btn-primary" type="submit">Create appointment</button>
                    </div>
                </form>
            </article>
        </div>
    `;

    // Navigation
    container.querySelectorAll('.nav-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            container.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Event Listeners
    document.getElementById('schedule-next-form').addEventListener('submit', handleNextSlot);
    document.getElementById('mechanic-day-form').addEventListener('submit', handleMechanicDay);
    document.getElementById('appointment-form').addEventListener('submit', handleAppointmentCreate);
}

async function handleNextSlot(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const query = {
        mechanic_id: fd.get('mechanic_id'),
        location_id: fd.get('location_id'),
        duration_minutes: fd.get('duration_minutes'),
        from: fd.get('from'),
    };
    try {
        const slot = await apiRequest('/schedule/next-slot', { query });
        if (!slot) {
            notify('No slot available', 'error');
            return;
        }
        state.nextSlot = slot;
        const card = document.getElementById('next-slot-card');
        if (card) {
            const startLabel = slot.start_at ? new Date(String(slot.start_at)).toLocaleString() : '—';
            const endLabel = slot.end_at ? new Date(String(slot.end_at)).toLocaleString() : '—';
            card.innerHTML = `
                <h2>Next Available Slot</h2>
                <p><strong>${startLabel}</strong> → ${endLabel}</p>
                <p class="muted">Adjust filters in the scheduling tab.</p>
            `;
        }
        notify('Slot located', 'success');
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleMechanicDay(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const query = {
        mechanic_id: fd.get('mechanic_id'),
        day: fd.get('day'),
    };
    try {
        const res = await apiRequest('/schedule/mechanic', { query });
        const {
            appointments = [],
            day = null,
        } = res || {};
        state.mechanicDay = appointments;
        state.mechanicDayMeta = day;
        const container = document.getElementById('mechanic-day-results');
        if (!state.mechanicDay.length) {
            container.textContent = 'No appointments for that day.';
        } else {
            container.innerHTML = state.mechanicDay.map((appt = {}) => {
                const {
                    start_at: startAt,
                    work_order_id: workOrderId = '',
                    status = '',
                } = appt;
                const startLabel = startAt ? new Date(String(startAt)).toLocaleTimeString() : '—';
                return `
                <div class="pill">
                    ${startLabel} · WO ${workOrderId} · ${status}
                </div>
            `;
            }).join('');
        }
        notify('Schedule loaded', 'success');
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleAppointmentCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const woId = Number(fd.get('work_order_id'));
    const body = {
        start_at: fd.get('start_at'),
        end_at: fd.get('end_at'),
        assigned_to: fd.get('assigned_to') ? Number(fd.get('assigned_to')) : null,
        location_id: fd.get('location_id') ? Number(fd.get('location_id')) : null,
        status: fd.get('status') || 'scheduled',
        notes: fd.get('notes') || null,
    };
    try {
        const res = await apiRequest(`/work-orders/${woId}/appointments`, { method: 'POST', body });
        notify(`Appointment #${res.id} created`, 'success');
        evt.target.reset();
    } catch (err) {
        notify(err.message, 'error');
    }
}
