// common.js
window.CommonReady = (async () => {

    // -------- Load HTML fragments --------
    async function loadHTML(selectorOrId, url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to load ${url}`);
            const html = await res.text();

            // Determine if it's a selector (querySelectorAll) or an ID
            if (selectorOrId.startsWith('#')) {
                const el = document.getElementById(selectorOrId.slice(1));
                if (el) el.innerHTML = html;
            } else {
                document.querySelectorAll(selectorOrId).forEach(el => el.innerHTML = html);
            }
        } catch (err) {
            console.error(err);
        }
    }

    // -------- Data-include support --------
    const includeElements = document.querySelectorAll('[data-include]');
    for (const el of includeElements) {
        const file = el.getAttribute('data-include');
        if (file) await loadHTML(`#${el.id}`, file).catch(() => {
            // fallback to direct innerHTML if no id
            fetch(file)
                .then(r => r.text())
                .then(txt => el.innerHTML = txt)
                .catch(err => console.error(err));
        });
    }

    // -------- Hamburger Menu --------
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("open");
        });
    }

    // -------- Other specific includes --------
    await loadHTML('#topbar', '/includes/topbar.html');
    await loadHTML('#sidebar', '/includes/sidebar.html');
    await loadHTML('#attendanceModalContainer', '/includes/attendance-modal.html');

    // -------- Logout --------
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const res = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        const j = await res.json();
        if (j?.success) window.location.href = 'login.html';
        else alert('Logout failed');
    });

    // -------- Sidebar navigation --------

    const sidebarItems = document.querySelectorAll('.sidebar li');

    const tabMapping = {
        dashboard: 'admin.html?tab=dashboard',
        bookings: 'admin.html?tab=bookings',
        upcoming: 'admin.html?tab=upcoming',
        instructors: 'admin.html?tab=instructors',
        branches: 'admin.html?tab=branches',
        cars: 'admin.html?tab=cars',
        schedule: 'admin.html?tab=schedule',
        trainingDays: 'admin.html?tab=trainingDays',
        enquiries: 'admin.html?tab=enquiries',
        courses: 'admin.html?tab=courses'
    };

    sidebarItems.forEach(li => {
        li.addEventListener('click', () => {
            const section = li.dataset.section;
            if (!section || !tabMapping[section]) return;
            window.location.href = tabMapping[section];
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

// Initialize modal if available
window.addEventListener("DOMContentLoaded", () => {
    if (window.Modal) Modal.init();
});
