// common.js
window.CommonReady = (async () => {

    // -------- Load HTML fragments --------
    async function loadHTML(id, url) {
        const res = await fetch(url);
        if (!res.ok) return console.error(`Failed to load ${url}`);
        const html = await res.text();
        document.getElementById(id).innerHTML = html;
    }

    await loadHTML('topbar', '/includes/topbar.html');
    await loadHTML('sidebar', '/includes/sidebar.html');
    await loadHTML('attendanceModalContainer', '/includes/attendance-modal.html');

    // -------- Logout --------
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const res = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        const j = await res.json();
        if (j?.success) window.location.href = 'login.html';
        else alert('Logout failed');
    });

    // -------- Sidebar navigation --------
    const sidebarItems = document.querySelectorAll('.sidebar li');
    sidebarItems.forEach(li => {
        li.addEventListener('click', () => {
            sidebarItems.forEach(i => i.classList.remove('active'));
            li.classList.add('active');
            const section = li.dataset.section;
            if (section === 'bookings') window.location.href = 'admin.html';
            else if (section === 'upcoming') window.location.href = 'admin.html?tab=upcoming';
            else if (section === 'instructors') window.location.href = 'admin.html?tab=instructors';
            else if (section === 'branches') window.location.href = 'admin.html?tab=branches';
            else if (section === 'cars') window.location.href = 'admin.html?tab=cars';
            else if (section === 'schedule') window.location.href = 'admin.html?tab=schedule';
            else if (section === 'trainingDays') window.location.href = 'admin.html?tab=trainingDays';
            else if (section === 'enquiries') window.location.href = 'admin.html?tab=enquiries';
            else if (section === 'courses') window.location.href = 'admin.html?tab=courses';
        });
    });

    // -------- API helper --------
    window.api = async function(path, opts = {}) {
        opts.headers = { 'Content-Type': 'application/json', ...opts.headers };
        opts.credentials = 'same-origin';
        if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
        const res = await fetch(path, opts);
        if (res.status === 401) window.location.href = 'login.html';
        return res.json();
    };
})();


window.addEventListener("DOMContentLoaded", () => {
    if (window.Modal) Modal.init();
});
