(async () => {
    await window.CommonReady;

    const tableWrap = document.getElementById('tableWrap');
    const searchInput = document.getElementById('searchInput');
    const addBtn = document.getElementById('addBtn');

    const urlParams = new URLSearchParams(window.location.search);
    let currentTab = urlParams.get('tab') || 'bookings';
    let lastSearch = '';

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function filterBookings(bookings, query) {
        if (!query) return bookings;
        query = query.trim().toLowerCase();
        return bookings.filter(b =>
            [b.customer_name, b.mobile_no, b.whatsapp_no, b.branch, b.car_name, b.instructor_name]
            .some(f => (f||'').toLowerCase().includes(query))
        );
    }

    function filterUpcoming(bookings) {
        const today = new Date(); today.setHours(0,0,0,0);
        return bookings.filter(b => {
            if (!b.starting_from) return false;
            const start = new Date(b.starting_from); start.setHours(0,0,0,0);
            const diffDays = (today - start) / MS_PER_DAY;
            return diffDays >= 0 && diffDays <= 30;
        });
    }

    // ================= Tab renderers =================
    const tabRenderers = {
        bookings: async () => {
            try {
                const res = await window.api('/api/bookings');
                if(!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                const rows = filterBookings(res.bookings, lastSearch);
                if(!rows.length){
                    tableWrap.innerHTML = '<div class="empty">No bookings found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                let html = `<table class="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Name</th><th>Mobile</th><th>WhatsApp</th>
                            <th>Car</th><th>Instructor</th><th>Branch</th><th>Training Days</th>
                            <th>Pincode</th><th>Total Fees</th><th>Advance</th><th>Starting From</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(b => `<tr id="booking-${b.id}">
                            <td>${b.id}</td>
                            <td>${b.customer_name||'-'}</td>
                            <td>${b.mobile_no||'-'}</td>
                            <td>${b.whatsapp_no||'-'}</td>
                            <td>${b.car_name||'-'}</td>
                            <td>${b.instructor_name||'-'}</td>
                            <td>${b.branch||'-'}</td>
                            <td>${b.training_days||'-'}</td>
                            <td>${b.pincode||'-'}</td>
                            <td>${b.total_fees||'-'}</td>
                            <td>${b.advance||'-'}</td>
                            <td>${b.starting_from?formatDate(b.starting_from):'-'}</td>
                            <td>
                                <button class="btn details" data-id="${b.id}">Details</button>
                                <button class="btn delete" data-id="${b.id}">Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;

                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);

            } catch(err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
        },

        upcoming: async () => {
            try {
                const res = await window.api('/api/bookings');
                if(!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                const rows = filterUpcoming(res.bookings);
                if(!rows.length){
                    tableWrap.innerHTML = '<div class="empty">No upcoming bookings found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                tableWrap.innerHTML = `<table class="bookings-table">
                    <thead>
                        <tr>
                            <th>Name</th><th>Car</th><th>Instructor</th><th>Training Days</th>
                            <th>Starting From</th><th>Branch</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(b => `<tr id="booking-${b.id}">
                            <td>${b.customer_name||'-'}</td>
                            <td>${b.car_name||'-'}</td>
                            <td>${b.instructor_name||'-'}</td>
                            <td>${b.training_days||'-'}</td>
                            <td>${b.starting_from?formatDate(b.starting_from):'-'}</td>
                            <td>${b.branch||'-'}</td>
                            <td>
                                <button class="btn attendance" data-id="${b.id}">Attendance</button>
                                <button class="btn delete" data-id="${b.id}">Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;

                window.scrollTo(0, scrollTop);

            } catch(err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
        },

        instructors: async () => {
            try {
                const res = await window.api('/api/instructors');
                if(!res.success) throw new Error(res.error || 'Failed to fetch instructors');

                if(!res.instructors.length){
                    tableWrap.innerHTML = '<div class="empty">No instructors found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                let html = `<table class="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Employee No</th><th>Name</th><th>Email</th><th>Mobile</th>
                            <th>Branch</th><th>Driver Licence</th><th>Adhar</th><th>Address</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${res.instructors.map(i => `
                        <tr id="instructor-${i.id}">
                            <td>${i.id}</td>
                            <td>${i.employee_no || '-'}</td>
                            <td>${i.instructor_name || '-'}</td>
                            <td>${i.email || '-'}</td>
                            <td>${i.mobile_no || '-'}</td>
                            <td>${i.branch || '-'}</td>
                            <td>${i.drivers_license || '-'}</td>
                            <td>${i.adhar_no || '-'}</td>
                            <td>${i.address || '-'}</td>
                            <td><button class="btn delete" data-id="${i.id}">Delete</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;

                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);

            } catch(err){
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
        }
    };

    // ================= Tab switching =================
    const sidebarItems = document.querySelectorAll('.sidebar li');

    async function switchTab(tab) {
        currentTab = tab;
        sidebarItems.forEach(i => i.classList.toggle('active', i.dataset.section === tab));
        if(tabRenderers[tab]) await tabRenderers[tab]();
    }

    sidebarItems.forEach(i => {
        i.addEventListener('click', e => {
            e.preventDefault();
            switchTab(i.dataset.section || 'bookings');
        });
    });

    // ================= Search input =================
    searchInput?.addEventListener('input', e => {
        lastSearch = e.target.value;
        if(tabRenderers[currentTab]) tabRenderers[currentTab]();
    });

    // ================= Add new button =================
    addBtn?.addEventListener("click", e => {
        e.preventDefault();
        if(currentTab === "instructors") openInstructorAddModal();
        else window.location.href = "index.html";
    });

    // ================= Table actions =================
    tableWrap.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        if(!id) return;

        if(e.target.classList.contains('delete')) {
            if(!confirm("Are you sure?")) return;
            if(currentTab === "bookings") await window.api(`/api/bookings/${id}`, { method: "DELETE" });
            if(currentTab === "instructors") await window.api(`/api/instructors/${id}`, { method: "DELETE" });
            if(tabRenderers[currentTab]) tabRenderers[currentTab]();
        }

        if(e.target.classList.contains('details') && currentTab === 'bookings') {
            window.location.href = `details.html?id=${id}`;
        }

        if(e.target.classList.contains('attendance') && currentTab === 'upcoming') {
            const bookings = (await window.api('/api/bookings')).bookings;
            const booking = bookings.find(b => b.id == id);
            window.openAttendanceModal({ ...booking, refresh: () => tabRenderers[currentTab]() });
        }
    });

    // ================= Initial load =================
    await switchTab(currentTab);

    // ================= Modal =================
    function openInstructorAddModal() {
        if(!window.Modal) { console.error("Modal library not loaded"); return; }
        if(!window.Modal.el) {
            try { window.Modal.init(); } 
            catch(err) { console.error("Modal init failed:", err); return; }
        }

        const innerFormHTML = `
            <h2>Add Instructor</h2>
            <div class="modal-content-form">
                <label>Name</label>
                <input id="ins_name" type="text" placeholder="Instructor Name">

                <label>Email</label>
                <input id="ins_email" type="email" placeholder="Email">

                <label>Mobile</label>
                <input id="ins_mobile" type="text" placeholder="Mobile">

                <label>Branch</label>
                <input id="ins_branch" type="text" placeholder="Branch">

                <label>Driver Licence</label>
                <input id="ins_license" type="text" placeholder="Driver Licence">

                <label>Adhar No</label>
                <input id="ins_adhar" type="text" placeholder="Adhar">

                <label>Address</label>
                <textarea id="ins_address" placeholder="Address"></textarea>

                <button id="saveInstructor" class="btn primary">Save Instructor</button>
            </div>
        `;

        window.Modal.setContent(innerFormHTML);
        window.Modal.show();

        setTimeout(() => {
            const saveBtn = document.getElementById("saveInstructor");
            if(!saveBtn) return;


        }, 50);
    }

})();
