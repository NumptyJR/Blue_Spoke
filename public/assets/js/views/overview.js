// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: overview.js
// Description: Overview view

import { setActiveView } from '../router.js';
import { state } from '../state.js';

export function initOverview() {
    const container = document.getElementById('view-overview');
    container.innerHTML = `
        <div class="dashboard-welcome">
            <h2>Welcome back</h2>
            <p>Here's what's happening in the shop today.</p>
        </div>
        <div class="dashboard-grid">
            <div class="dashboard-card" data-jump="workorders-list" data-view="workorders">
                <div class="dashboard-icon" style="color: #3b82f6; background: #eff6ff;">🗂️</div>
                <div>
                    <h3 class="dashboard-title">Active Tickets</h3>
                    <div class="dashboard-desc">Monitor the queue and track progress</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="workorder-create" data-view="workorders">
                <div class="dashboard-icon" style="color: #10b981; background: #ecfdf5;">📝</div>
                <div>
                    <h3 class="dashboard-title">New Work Order</h3>
                    <div class="dashboard-desc">Check in a bike for service</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="inventory-search" data-view="inventory">
                <div class="dashboard-icon" style="color: #f59e0b; background: #fffbeb;">🔍</div>
                <div>
                    <h3 class="dashboard-title">Item Search</h3>
                    <div class="dashboard-desc">Find parts and view inventory</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="customers-search" data-view="customers">
                <div class="dashboard-icon" style="color: #8b5cf6; background: #f5f3ff;">👤</div>
                <div>
                    <h3 class="dashboard-title">Customers</h3>
                    <div class="dashboard-desc">Manage riders and history</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="schedule-next" data-view="scheduling">
                <div class="dashboard-icon" style="color: #ec4899; background: #fdf2f8;">📅</div>
                <div>
                    <h3 class="dashboard-title">Scheduling</h3>
                    <div class="dashboard-desc">Check bay availability</div>
                </div>
            </div>
        </div>
    `;

    container.querySelectorAll('.dashboard-card').forEach(card => {
        card.addEventListener('click', () => {
            const view = card.dataset.view;
            const jump = card.dataset.jump;
            setActiveView(view);
            if (jump) {
                setTimeout(() => {
                    const target = document.getElementById(jump);
                    if (target) {
                        const navBtn = document.querySelector(`button[data-section="${jump}"]`);
                        if (navBtn) navBtn.click();
                    }
                }, 50);
            }
        });
    });


}


