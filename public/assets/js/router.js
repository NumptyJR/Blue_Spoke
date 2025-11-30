import { state } from './state.js';

export function setActiveView(view) {
    state.view = view;
    const navButtons = document.querySelectorAll('.sidebar button[data-view]');
    const views = document.querySelectorAll('.view');

    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    views.forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
}
