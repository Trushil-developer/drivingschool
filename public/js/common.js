// common.js
window.CommonReady = (async () => {

    /* =====================================
       LOAD HTML INCLUDES
    ===================================== */
    async function loadHTML(selectorOrId, url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to load ${url}`);
            const html = await res.text();

            if (selectorOrId.startsWith('#')) {
                const el = document.getElementById(selectorOrId.slice(1));
                if (el) el.innerHTML = html;
            } else {
                document.querySelectorAll(selectorOrId).forEach(el => {
                    el.innerHTML = html;
                });
            }
        } catch (err) {
            console.error(err);
        }
    }

    /* =====================================
       DATA-INCLUDE SUPPORT
    ===================================== */
    const includeElements = document.querySelectorAll('[data-include]');
    for (const el of includeElements) {
        const file = el.getAttribute('data-include');
        if (!file) continue;

        try {
            const res = await fetch(file);
            const html = await res.text();
            el.innerHTML = html;
        } catch (err) {
            console.error(err);
        }
    }

    /* =====================================
       HAMBURGER MENU
    ===================================== */
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("open");
        });
    }

    /* =====================================
       CLOSE MOBILE MENU ON LINK CLICK (FIX)
    ===================================== */
    document.addEventListener("click", (e) => {
        const navLink = e.target.closest(".header-nav a");
        if (!navLink) return;

        if (window.innerWidth <= 768) {
            hamburger?.classList.remove("active");
            navMenu?.classList.remove("open");
        }
    });

    /* =====================================
       HIGHLIGHT ACTIVE HEADER TAB
    ===================================== */
    function highlightActiveNav() {
        const currentPage =
            location.pathname.split("/").pop() || "index.html";

        document.querySelectorAll(".header-nav a").forEach(link => {
            const href = link.getAttribute("href");
            if (href === currentPage) {
                link.classList.add("active");
            }
        });
    }

    // Header loads async → wait briefly
    setTimeout(highlightActiveNav, 80);

    /* =====================================
       OPTIONAL ADMIN INCLUDES
    ===================================== */
    await loadHTML('#topbar', '/includes/topbar.html');
    await loadHTML('#sidebar', '/includes/sidebar.html');
    await loadHTML('#attendanceModalContainer', '/includes/attendance-modal.html');

    /* =====================================
       LOGOUT
    ===================================== */
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const res = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const j = await res.json();

        if (j?.success) {
            window.location.href = 'login.html';
        } else {
            alert('Logout failed');
        }
    });

    /* =====================================
       SIDEBAR NAVIGATION (ADMIN)
    ===================================== */
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
        courses: 'admin.html?tab=courses',
        cms: 'admin.html?tab=cms'
    };

    sidebarItems.forEach(li => {
        li.addEventListener('click', () => {
            const section = li.dataset.section;
            if (!section || !tabMapping[section]) return;
            window.location.href = tabMapping[section];
        });
    });

    /* =====================================
       API HELPER
    ===================================== */
    window.api = async function (path, opts = {}) {
        opts.headers = {
            'Content-Type': 'application/json',
            ...opts.headers
        };
        opts.credentials = 'same-origin';

        if (opts.body && typeof opts.body === 'object') {
            opts.body = JSON.stringify(opts.body);
        }

        const res = await fetch(path, opts);

        if (res.status === 401) {
            window.location.href = 'login.html';
        }

        return res.json();
    };

})();

/* =====================================
   OPTIONAL MODAL INIT
===================================== */
window.addEventListener("DOMContentLoaded", () => {
    if (window.Modal) {
        Modal.init();
    }
});
