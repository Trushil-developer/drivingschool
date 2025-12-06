window.renderScheduleSectionFactory = null;
window.registerScheduleModule = function (factory) {
    window.renderScheduleSectionFactory = factory;
};

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

    function filterData(tab, items, query) {
        if (!query) return items;
        query = query.trim().toLowerCase();
        switch(tab) {
            case 'bookings':
            case 'upcoming':
                return items.filter(b =>
                    [b.customer_name, b.mobile_no, b.whatsapp_no, b.branch, b.car_name, b.instructor_name]
                    .some(f => (f||'').toLowerCase().includes(query))
                );
            case 'instructors':
                return items.filter(i =>
                    [i.instructor_name, i.email, i.mobile_no, i.branch, i.drivers_license, i.adhar_no]
                    .some(f => (f||'').toLowerCase().includes(query))
                );
            case 'cars':
                return items.filter(c =>
                    [c.car_name, c.branch, c.car_registration_no]
                    .some(f => (f || '').toLowerCase().includes(query))
                );
            case 'branches':
                return items.filter(b =>
                    [b.branch_name, b.city, b.state, b.mobile_no, b.email]
                    .some(f => (f || '').toLowerCase().includes(query))
                );
            default:
                return items;
        }
    }

    function filterUpcoming(bookings) {
        const today = new Date(); today.setHours(0,0,0,0);
        return bookings.filter(b => {
            if (!b.starting_from) return false;
            if (b.attendance_fulfilled) return false;
            const start = new Date(b.starting_from); start.setHours(0,0,0,0);
            const diffDays = (today - start) / MS_PER_DAY;
            return diffDays >= 0 && diffDays <= 30;
        });
    }

    const tabRenderers = {
        bookings: async () => {
            try {
                const res = await window.api('/api/bookings');
                if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                const rows = filterData('bookings', res.bookings, lastSearch);

                if (!rows.length) {
                    tableWrap.innerHTML = '<div class="empty">No bookings found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                const html = `
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Car</th>
                                <th>Instructor</th>
                                <th>Branch</th>
                                <th>Attendance</th>
                                <th>Status</th>
                                <th>Total Fees</th>
                                <th>Starting From</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(b => `
                                <tr id="booking-${b.id}">
                                    <td>${b.id}</td>
                                    <td>
                                        <a href="details.html?id=${b.id}" class="customer-link">
                                            ${b.customer_name || '-'}
                                        </a>
                                    </td>
                                    <td>${b.car_name || '-'}</td>
                                    <td>${b.instructor_name || '-'}</td>
                                    <td>${b.branch || '-'}</td>
                                    <td>${b.present_days || 0}/${b.training_days || '-'}</td>
                                    <td class="status-${b.attendance_status.toLowerCase()}">${b.attendance_status || '-'}</td>
                                    <td>${b.advance || 0}/${b.total_fees || 0}</td>
                                    <td>${b.starting_from ? formatDate(b.starting_from) : '-'}</td>
                                    <td>
                                        <button class="btn delete" data-id="${b.id}">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);
            } catch (err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
        },
        upcoming: async () => {
            try {
                const res = await window.api('/api/bookings');
                if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                const bookings = res.bookings;

                    // Fetch ALL attendance at once
                    const allAtt = await window.api('/api/attendance-all');

                    // Build fast lookup table
                    const attendanceMap = {};
                    for (let row of allAtt.records) {
                        if (!attendanceMap[row.booking_id]) {
                            attendanceMap[row.booking_id] = [];
                        }
                        attendanceMap[row.booking_id].push(row);
                    }

                for (let b of bookings) {
                    const existingAttendance = attendanceMap[b.id] || [];
                    const totalDays = b.training_days == "21" ? 21 : 15;

                    b.attendance_fulfilled =
                        existingAttendance.filter(e => e.present == 1).length >= totalDays;
                }

                const rows = filterData('bookings', filterUpcoming(bookings), lastSearch);

                if (!rows.length) {
                    tableWrap.innerHTML = '<div class="empty">No upcoming bookings found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                const html = `
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Car</th>
                                <th>Instructor</th>
                                <th>Branch</th>
                                <th>Attendance</th>
                                <th>Status</th>
                                <th>Starting From</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(b => `
                                <tr id="booking-${b.id}">
                                    <td>${b.id}</td>
                                    <td>
                                        <a href="details.html?id=${b.id}" class="customer-link">
                                            ${b.customer_name || '-'}
                                        </a>
                                    </td>
                                    <td>${b.car_name || '-'}</td>
                                    <td>${b.instructor_name || '-'}</td>
                                    <td>${b.branch || '-'}</td>
                                    <td>${b.present_days || 0}/${b.training_days || '-'}</td>
                                    <td class="status-${b.attendance_status.toLowerCase()}">${b.attendance_status || '-'}</td>
                                    <td>${b.starting_from ? formatDate(b.starting_from) : '-'}</td>
                                    <td>
                                        <button class="btn attendance" data-id="${b.id}">Attendance</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);

            } catch (err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
        },
        instructors: () => {
            if (typeof window.renderInstructorsModule !== "function") {
                tableWrap.innerHTML = '<div class="error">Instructors module not loaded</div>';
                return Promise.resolve();
            }
            const renderer = window.renderInstructorsModule(tableWrap, tabRenderers, currentTab);
            return renderer();
        },
        cars: () => {
            if (typeof window.renderCarsModule !== "function") {
                tableWrap.innerHTML = '<div class="error">Cars module not loaded</div>';
                return Promise.resolve();
            }
            return window.renderCarsModule(tableWrap, tabRenderers, currentTab)();
        },
        branches: () => {
            if (typeof window.renderBranchesModule !== "function") {
                tableWrap.innerHTML = '<div class="error">Branches module not loaded</div>';
                return Promise.resolve();
            }
            const renderer = window.renderBranchesModule(tableWrap);
            return renderer();
        },  
        schedule: function () {
            if (typeof window.renderScheduleModule !== "function") {
                tableWrap.innerHTML = '<div class="error">Schedule module not loaded</div>';
                return Promise.resolve();
            }

            const renderer = window.renderScheduleModule(tableWrap);
            return renderer();
        },
        trainingDays: () => {
            if(typeof window.renderTrainingDaysModule !== "function") {
                tableWrap.innerHTML = '<div class="error">Training Days module not loaded</div>';
                return Promise.resolve();
            }
            const renderer = window.renderTrainingDaysModule(tableWrap);
            return renderer();
        }
    };

    const sidebarItems = document.querySelectorAll('.sidebar li');

    async function switchTab(tab) {
        currentTab = tab;
        sidebarItems.forEach(i => i.classList.toggle('active', i.dataset.section === tab));

        // Hide search/add for schedule tab
        if (tab === 'schedule') {
            searchInput?.classList.add('hidden');
            addBtn?.classList.add('hidden');
        } else if (tab === 'trainingDays') {
            searchInput?.classList.add('hidden'); addBtn?.classList.remove('hidden'); 
        }else {
            searchInput?.classList.remove('hidden');
            addBtn?.classList.remove('hidden');
        }

        if(tabRenderers[tab]) await tabRenderers[tab]();

        const newUrl = new URL(window.location);
        newUrl.searchParams.set('tab', tab);
        window.history.replaceState({}, '', newUrl);
    }

    sidebarItems.forEach(i => {
        i.addEventListener('click', e => {
            e.preventDefault();
            switchTab(i.dataset.section || 'bookings');
        });
    });

    searchInput?.addEventListener('input', e => {
        lastSearch = e.target.value;
        if(tabRenderers[currentTab]) tabRenderers[currentTab]();
    });

    addBtn?.addEventListener("click", e => {
        e.preventDefault();
        if (currentTab === "instructors") window.openInstructorAddModal(tabRenderers, currentTab)();
        else if (currentTab === "cars") window.openCarAddModal(tabRenderers, currentTab)();
        else if (currentTab === "branches") openBranchModal(tabRenderers, currentTab)();
        else if (currentTab === "trainingDays") openTrainingDaysModal(tabRenderers, currentTab);
        else window.location.href = "index.html";
    });

    tableWrap.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        if(!id) return;

        if (e.target.classList.contains('delete')) {

            const id = e.target.dataset.id;
            if (!id) return;

            // Password protection
            const pwd = prompt("Enter admin password to delete:");
            if (!pwd) return alert("Deletion cancelled");

            const ADMIN_PASSWORD = "1234"; 
            if (pwd !== ADMIN_PASSWORD) {
                alert("Incorrect password!");
                return;
            }

            const deleteApiMap = {
                bookings: '/api/bookings',
                instructors: '/api/instructors',
                cars: '/api/cars',
                branches: '/api/branches',
                trainingDays: '/api/training-days'
            };

            const apiUrl = deleteApiMap[currentTab];

            try {
                const res = await window.api(`${apiUrl}/${id}`, {
                    method: "DELETE"
                });

                if (!res.success) {
                    alert(res.error || "Delete failed");
                    return;
                }

                alert("Deleted successfully!");

                if (tabRenderers[currentTab]) {
                    tabRenderers[currentTab]();
                }
            } catch (err) {
                console.error(err);
                alert("Error deleting record");
            }
        }

        if(e.target.classList.contains('details') && currentTab === 'bookings') {
            window.location.href = `details.html?id=${id}`;
        }
        if(e.target.classList.contains('attendance') && currentTab === 'upcoming') {
            const bookings = (await window.api('/api/bookings')).bookings;
            const booking = bookings.find(b => b.id == id);
            window.openAttendanceModal({ ...booking, refresh: () => tabRenderers[currentTab]() });
        }
        if(e.target.classList.contains('edit-car') && currentTab === 'cars') {
            const data = {
                car_name: e.target.dataset.name || '',
                branch: e.target.dataset.branch || '', 
                car_registration_no: e.target.dataset.car_registration_no || '',
                insurance_policy_no: e.target.dataset.insurance_policy_no || '',
                insurance_company: e.target.dataset.insurance_company || '',
                insurance_issue_date: e.target.dataset.insurance_issue_date || '',
                insurance_expiry_date: e.target.dataset.insurance_expiry_date || '',
                puc_issue_date: e.target.dataset.puc_issue_date || '',
                puc_expiry_date: e.target.dataset.puc_expiry_date || ''
            };
            window.openCarEditModal(id, data, tabRenderers, currentTab)();
        }

        if(e.target.classList.contains('edit-instructor') && currentTab === 'instructors') {
            const data = {
                instructor_name: e.target.dataset.name,
                email: e.target.dataset.email,
                mobile_no: e.target.dataset.mobile,
                branch: e.target.dataset.branch,
                drivers_license: e.target.dataset.license,
                adhar_no: e.target.dataset.adhar,
                address: e.target.dataset.address,
            };
            openInstructorEditModal(id, data);
        }
        if (e.target.classList.contains('edit-branch') && currentTab === 'branches') {
            const data = {
                branch_name: e.target.dataset.name,
                city: e.target.dataset.city,
                state: e.target.dataset.state,
                mobile_no: e.target.dataset.mobile,
                email: e.target.dataset.email,
            };

            openBranchEditModal(id, data, tabRenderers, currentTab)();
        }

    });


    await switchTab(currentTab);
})();
