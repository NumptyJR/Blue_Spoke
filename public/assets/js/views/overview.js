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
                <div class="dashboard-icon" style="color: #3b82f6; background: #eff6ff;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                </div>
                <div>
                    <h3 class="dashboard-title">Active Tickets</h3>
                    <div class="dashboard-desc">Monitor the queue and track progress</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="workorder-create" data-view="workorders">
                <div class="dashboard-icon" style="color: #10b981; background: #ecfdf5;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                </div>
                <div>
                    <h3 class="dashboard-title">New Work Order</h3>
                    <div class="dashboard-desc">Check in a bike for service</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="inventory-search" data-view="inventory">
                <div class="dashboard-icon" style="color: #f59e0b; background: #fffbeb;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                </div>
                <div>
                    <h3 class="dashboard-title">Item Search</h3>
                    <div class="dashboard-desc">Find parts and view inventory</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="customers-search" data-view="customers">
                <div class="dashboard-icon" style="color: #8b5cf6; background: #f5f3ff;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </div>
                <div>
                    <h3 class="dashboard-title">Customers</h3>
                    <div class="dashboard-desc">Manage riders and history</div>
                </div>
            </div>
            <div class="dashboard-card" data-jump="schedule-next" data-view="scheduling">
                <div class="dashboard-icon" style="color: #ec4899; background: #fdf2f8;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                </div>
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


