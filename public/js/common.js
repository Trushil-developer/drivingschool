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

    // -------- Attendance Modal --------
    window.openAttendanceModal = async function(booking) {
        if (!booking.starting_from) return alert("Starting date missing");

        const overlay = document.getElementById('attendanceOverlay');
        const modal = document.getElementById('attendanceModal');
        const tbody = document.querySelector('#attendanceTable tbody');
        const saveBtn = document.getElementById('saveAttendanceBtn');
        const closeBtn = document.getElementById('closeAttendanceBtn');

        overlay.classList.add('active');
        modal.classList.add('active');
        tbody.innerHTML = '';

        const totalDays = 30; // always 30 days
        const startDate = new Date(booking.starting_from);

        const res = await window.api(`/api/attendance/${booking.id}`);
        const existing = res.records || [];
        const todayStr = new Date().toISOString().split("T")[0];

        // ====== HARD-CODED LOCK PASSWORD ======
        const LOCK_PASSWORD = "myLock123"; // <-- set your lock password here

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];
            const isPresent = existing.some(e => e.date.split('T')[0] === dateStr && e.present == 1);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>Day ${i + 1}</td>
                <td>${dateStr}</td>
                <td>
                    <input type="checkbox" data-date="${dateStr}" ${isPresent ? "checked" : ""}>
                </td>
            `;
            const checkbox = row.querySelector('input[type="checkbox"]');

            if (dateStr > todayStr) {
                checkbox.disabled = true;
                checkbox.title = "Future attendance cannot be modified";
            } else if (dateStr < todayStr) {
                checkbox.disabled = true;
                const lockBtn = document.createElement('button');
                lockBtn.textContent = '🔒';
                lockBtn.className = 'btn btn-ghost btn-sm';
                lockBtn.title = "Click to unlock with password";
                lockBtn.style.marginLeft = "8px";

                lockBtn.addEventListener('click', () => {
                    const pw = prompt("Enter lock password to unlock previous attendance");
                    if (pw !== LOCK_PASSWORD) {
                        alert("Incorrect password!");
                        return;
                    }
                    checkbox.disabled = false;
                    lockBtn.remove();
                });

                row.querySelector('td').appendChild(lockBtn);
            }

            tbody.appendChild(row);
        }

        saveBtn.onclick = async () => {
            const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
            const attendance = [];
            checkboxes.forEach(cb => {
                if(cb.checked) attendance.push({ date: cb.dataset.date });
            });

            const result = await window.api(`/api/attendance/${booking.id}`, {
                method: "POST",
                body: { attendance }
            });

            if(result.success){
                alert("Attendance saved!");
                overlay.classList.remove('active');
                modal.classList.remove('active');
                if(typeof booking.refresh === 'function') booking.refresh();
            } else alert("Failed to save attendance!");
        };

        closeBtn.onclick = () => {
            overlay.classList.remove('active');
            modal.classList.remove('active');
        };
    };


})();


window.addEventListener("DOMContentLoaded", () => {
    if (window.Modal) Modal.init();
});
