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
                                    <td>${b.attendance_status || '-'}</td>
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
                                    <td>${b.attendance_status || '-'}</td>
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
        cars: async () => {
            try {
                const res = await window.api('/api/cars');
                if (!res.success) throw new Error(res.error || 'Failed to fetch cars');

                const rows = filterData('cars', res.cars, lastSearch);
                if (!rows.length) {
                    tableWrap.innerHTML = '<div class="empty">No cars found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                let html = `
                    <table class="cars-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Car Name</th>
                                <th>Branch</th>
                                <th>Registration No</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(c => `
                                <tr class="car-row" data-id="${c.id}">
                                    <td>${c.id}</td>
                                    <td class="car-name" style="cursor:pointer; color:blue; text-decoration:underline;">
                                        ${c.car_name || '-'}
                                    </td>
                                    <td>${c.branch || '-'}</td>
                                    <td>${c.car_registration_no || '-'}</td>
                                    <td>
                                        <button class="btn edit"
                                            data-id="${c.id}"
                                            data-name="${c.car_name || ''}"
                                            data-branch="${c.branch || ''}"
                                            data-car_registration_no="${c.car_registration_no || ''}"
                                            data-insurance_policy_no="${c.insurance_policy_no || ''}"
                                            data-insurance_company="${c.insurance_company || ''}"
                                            data-insurance_issue_date="${c.insurance_issue_date || ''}"
                                            data-insurance_expiry_date="${c.insurance_expiry_date || ''}"
                                            data-puc_issue_date="${c.puc_issue_date || ''}"
                                            data-puc_expiry_date="${c.puc_expiry_date || ''}"
                                        >Edit</button>
                                        <button class="btn delete" data-id="${c.id}">Delete</button>
                                    </td>
                                </tr>
                                <tr class="car-details hidden" id="details-${c.id}">
                                    <td colspan="5">
                                        <strong>Insurance Policy:</strong> ${c.insurance_policy_no || '-'} <br>
                                        <strong>Insurance Company:</strong> ${c.insurance_company || '-'} <br>
                                        <strong>Insurance Issue:</strong> ${c.insurance_issue_date ? formatDate(c.insurance_issue_date) : '-'} <br>
                                        <strong>Insurance Expiry:</strong> ${c.insurance_expiry_date ? formatDate(c.insurance_expiry_date) : '-'} <br>
                                        <strong>PUC Issue:</strong> ${c.puc_issue_date ? formatDate(c.puc_issue_date) : '-'} <br>
                                        <strong>PUC Expiry:</strong> ${c.puc_expiry_date ? formatDate(c.puc_expiry_date) : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;


                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);

                // Add click listener to toggle details
                document.querySelectorAll(".car-name").forEach(el => {
                    el.addEventListener("click", e => {
                        const row = e.target.closest("tr");
                        const id = row.dataset.id;
                        const detailsRow = document.getElementById(`details-${id}`);
                        if (detailsRow) detailsRow.classList.toggle("hidden");
                    });
                });

            } catch (err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
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
        else if (currentTab === "cars") openCarAddModal();
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
        if(e.target.classList.contains('edit') && currentTab === 'cars') {
            const data = {
                car_name: e.target.dataset.name || '',
                insurance_policy_no: e.target.dataset.insurance_policy_no || '',
                insurance_company: e.target.dataset.insurance_company || '',
                insurance_issue_date: e.target.dataset.insurance_issue_date || '',
                insurance_expiry_date: e.target.dataset.insurance_expiry_date || '',
                puc_issue_date: e.target.dataset.puc_issue_date || '',
                puc_expiry_date: e.target.dataset.puc_expiry_date || ''
            };
            openCarEditModal(id, data);
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

    function openCarAddModal() {
        if (!window.Modal) return;
        if (!window.Modal.el) window.Modal.init();

        const formHTML = `
            <h2>Add Car</h2>
            <div class="modal-content-form car-modal">
                <label>Car Name</label>
                <input id="car_name" type="text" placeholder="Car Name" required>

                <label>Branch</label>
                <select id="branch">
                    <option value="">Loading...</option>
                </select>

                <label>Registration No</label>
                <input id="car_registration_no" type="text" placeholder="Car Registration No">

                <label>Insurance Policy No</label>
                <input id="insurance_policy_no" type="text" placeholder="Policy No">

                <label>Insurance Company</label>
                <input id="insurance_company" type="text" placeholder="Company No.">

                <label>Insurance Issue Date</label>
                <input id="insurance_issue_date" type="date">

                <label>Insurance Expiry Date</label>
                <input id="insurance_expiry_date" type="date">

                <label>PUC Issue Date</label>
                <input id="puc_issue_date" type="date">

                <label>PUC Expiry Date</label>
                <input id="puc_expiry_date" type="date">

                <button id="saveCar" class="btn primary">Save Car</button>
            </div>
        `;

        window.Modal.setContent(formHTML);
        window.Modal.show();

        setTimeout(() => {
            setTimeout(async () => {
                document.getElementById("branch").innerHTML = await getBranchOptionsHTML();
            }, 20);
            document.getElementById("saveCar").onclick = async () => {
                const payload = {
                    car_name: document.getElementById("car_name").value.trim(),
                    branch: document.getElementById("branch").value.trim(),
                    car_registration_no: document.getElementById("car_registration_no").value.trim(),
                    insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                    insurance_company: document.getElementById("insurance_company").value.trim(),
                    insurance_issue_date: document.getElementById("insurance_issue_date").value,
                    insurance_expiry_date: document.getElementById("insurance_expiry_date").value,
                    puc_issue_date: document.getElementById("puc_issue_date").value,
                    puc_expiry_date: document.getElementById("puc_expiry_date").value
                };


                if (!payload.car_name) return alert("Car name is required");

                try {
                    const res = await window.api("/api/cars", {
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!res.success) throw new Error(res.error || "Failed to save car");
                    alert("Car saved successfully!");
                    window.Modal.hide();
                    if (tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch (err) {
                    alert("Error: " + err.message);
                }
            };
        }, 50);
    }

    function openCarEditModal(id, data) {
        if (!window.Modal) return;
        if (!window.Modal.el) try { window.Modal.init(); } catch(err){ console.error(err); return; }

        const innerFormHTML = `
            <h2>Edit Car</h2>
            <div class="modal-content-form car-modal">
                <label>Car Name</label>
                <input id="car_name" type="text" value="${data.car_name || ''}" required>

                <label>Branch</label>
                <select id="branch">
                    <option value="">Loading...</option>
                </select>

                <label>Registration No</label>
                <input id="car_registration_no" type="text" value="${data.car_registration_no || ''}">

                <label>Insurance Policy No</label>
                <input id="insurance_policy_no" type="text" value="${data.insurance_policy_no || ''}">

                <label>Insurance Company</label>
                <input id="insurance_company" type="text" value="${data.insurance_company || ''}">

                <label>Insurance Issue Date</label>
                <input id="insurance_issue_date" type="date" value="${formatDateForInput(data.insurance_issue_date)}">

                <label>Insurance Expiry Date</label>
                <input id="insurance_expiry_date" type="date" value="${formatDateForInput(data.insurance_expiry_date)}">

                <label>PUC Issue Date</label>
                <input id="puc_issue_date" type="date" value="${formatDateForInput(data.puc_issue_date)}">

                <label>PUC Expiry Date</label>
                <input id="puc_expiry_date" type="date" value="${formatDateForInput(data.puc_expiry_date)}">

                <button id="saveCar" class="btn primary">Save Changes</button>
            </div>
        `;

        window.Modal.setContent(innerFormHTML);
        window.Modal.show();

        setTimeout(() => {
            setTimeout(async () => {
                document.getElementById("branch").innerHTML =
                    await getBranchOptionsHTML(data.branch);
            }, 20);
            const saveBtn = document.getElementById("saveCar");
            if(!saveBtn) return;

            saveBtn.addEventListener("click", async () => {
                const payload = {
                    car_name: document.getElementById("car_name").value.trim(),
                    branch: document.getElementById("branch").value.trim(),
                    car_registration_no: document.getElementById("car_registration_no").value.trim(),
                    insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                    insurance_company: document.getElementById("insurance_company").value.trim(),
                    insurance_issue_date: document.getElementById("insurance_issue_date").value || null,
                    insurance_expiry_date: document.getElementById("insurance_expiry_date").value || null,
                    puc_issue_date: document.getElementById("puc_issue_date").value || null,
                    puc_expiry_date: document.getElementById("puc_expiry_date").value || null
                };

                try {
                    const res = await window.api(`/api/cars/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to update car");
                    alert("Car updated successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            });
        }, 50);
    }

    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${month}-${day}`;
    }

    async function getBranchOptionsHTML(selected = "") {
        const res = await window.api("/api/branches");
        if (!res.success) return "<option value=''>No branches found</option>";

        return res.branches.map(b => `
            <option value="${b.branch_name}" ${selected === b.branch_name ? 'selected' : ''}>
                ${b.branch_name}
            </option>
        `).join('');
    }
})();
