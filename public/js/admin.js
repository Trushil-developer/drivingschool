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
                if(!res.success) throw new Error(res.error || 'Failed to fetch bookings');
                const rows = filterData('bookings', res.bookings, lastSearch);
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
                if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');
                const bookings = res.bookings;
                for (let b of bookings) {
                    const attRes = await window.api(`/api/attendance/${b.id}`);
                    const existingAttendance = attRes.records || [];
                    const totalDays = b.training_days == "21" ? 21 : 15;
                    b.attendance_fulfilled = existingAttendance.filter(e => e.present == 1).length >= totalDays;
                }
                const rows = filterData('bookings', filterUpcoming(res.bookings), lastSearch);
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
                const rows = filterData('instructors', res.instructors, lastSearch);
                if(!rows.length){
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
                        ${rows.map(i => `
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
                            <td>
                                <button class="btn edit-instructor" data-id="${i.id}" data-name="${i.instructor_name}" data-email="${i.email}" data-mobile="${i.mobile_no}" data-branch="${i.branch}" data-license="${i.drivers_license}" data-adhar="${i.adhar_no}" data-address="${i.address}">Edit</button>
                                <button class="btn delete" data-id="${i.id}">Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;
                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);
            } catch(err){
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            }
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
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Car Name</th>
                                <th>Branch</th>
                                <th>Registration No</th>
                                <th>Insurance Policy</th>
                                <th>Insurance Company</th>
                                <th>Insurance Issue</th>
                                <th>Insurance Expiry</th>
                                <th>PUC Issue</th>
                                <th>PUC Expiry</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(c => `
                                <tr id="car-${c.id}">
                                    <td>${c.id}</td>
                                    <td>${c.car_name || '-'}</td>
                                    <td>${c.branch || '-'}</td>
                                    <td>${c.car_registration_no || '-'}</td>
                                    <td>${c.insurance_policy_no || '-'}</td>
                                    <td>${c.insurance_company || '-'}</td>
                                    <td>${c.insurance_issue_date ? formatDate(c.insurance_issue_date) : '-'}</td>
                                    <td>${c.insurance_expiry_date ? formatDate(c.insurance_expiry_date) : '-'}</td>
                                    <td>${c.puc_issue_date ? formatDate(c.puc_issue_date) : '-'}</td>
                                    <td>${c.puc_expiry_date ? formatDate(c.puc_expiry_date) : '-'}</td>

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
        branches: async () => {
            try {
                const res = await window.api('/api/branches');
                if (!res.success) throw new Error(res.error || 'Failed to fetch branches');

                const rows = filterData('branches', res.branches, lastSearch);
                if (!rows.length) {
                    tableWrap.innerHTML = '<div class="empty">No branches found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                let html = `
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Branch Name</th>
                                <th>City</th>
                                <th>State</th>
                                <th>Mobile</th>
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                        ${rows.map(b => `
                            <tr id="branch-${b.id}">
                                <td>${b.id}</td>
                                <td>${b.branch_name || '-'}</td>
                                <td>${b.city || '-'}</td>
                                <td>${b.state || '-'}</td>
                                <td>${b.mobile_no || '-'}</td>
                                <td>${b.email || '-'}</td>
                                <td>
                                    <button class="btn edit-branch" data-id="${b.id}" 
                                        data-name="${b.branch_name}"
                                        data-city="${b.city}"
                                        data-state="${b.state}"
                                        data-mobile="${b.mobile_no}"
                                        data-email="${b.email}">
                                        Edit
                                    </button>

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
        }

    };

    const sidebarItems = document.querySelectorAll('.sidebar li');

    async function switchTab(tab) {
        currentTab = tab;
        sidebarItems.forEach(i => i.classList.toggle('active', i.dataset.section === tab));
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
        if(currentTab === "instructors") openInstructorAddModal();
        else if (currentTab === "cars") openCarAddModal();
        else if (currentTab === "branches") openBranchAddModal();
        else window.location.href = "index.html";
    });

    tableWrap.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        if(!id) return;
        if(e.target.classList.contains('delete')) {
            if(!confirm("Are you sure?")) return;
            if(currentTab === "bookings") await window.api(`/api/bookings/${id}`, { method: "DELETE" });
            if(currentTab === "instructors") await window.api(`/api/instructors/${id}`, { method: "DELETE" });
            if (currentTab === "cars") await window.api(`/api/cars/${id}`, { method: "DELETE" });
            if (currentTab === "branches") await window.api(`/api/branches/${id}`, { method: "DELETE" });
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

            openBranchEditModal(id, data);
        }

    });

    await switchTab(currentTab);

    function openInstructorAddModal() {
        if(!window.Modal) return;
        if(!window.Modal.el) try { window.Modal.init(); } catch(err){ console.error(err); return; }
        const innerFormHTML = `
            <h2>Add Instructor</h2>
            <div class="modal-content-form">
                <label>Name</label><input id="ins_name" type="text" placeholder="Instructor Name" required>
                <label>Email</label><input id="ins_email" type="email" placeholder="Email" required>
                <label>Mobile</label><input id="ins_mobile" type="text" placeholder="Mobile" required>
                <label>Branch</label><input id="ins_branch" type="text" placeholder="Branch" required>
                <label>Driver Licence</label><input id="ins_license" type="text" placeholder="Driver Licence" required>
                <label>Adhar No</label><input id="ins_adhar" type="text" placeholder="Adhar" required>
                <label>Address</label><textarea id="ins_address" placeholder="Address" required></textarea>
                <button id="saveInstructor" class="btn primary">Save Instructor</button>
            </div>
        `;
        window.Modal.setContent(innerFormHTML);
        window.Modal.show();
        setTimeout(() => {
            const saveBtn = document.getElementById("saveInstructor");
            if(!saveBtn) return;
            saveBtn.addEventListener("click", async () => {
                const instructorData = {
                    instructor_name: document.getElementById("ins_name").value.trim(),
                    email: document.getElementById("ins_email").value.trim(),
                    mobile_no: document.getElementById("ins_mobile").value.trim(),
                    branch: document.getElementById("ins_branch").value.trim(),
                    drivers_license: document.getElementById("ins_license").value.trim(),
                    adhar_no: document.getElementById("ins_adhar").value.trim(),
                    address: document.getElementById("ins_address").value.trim(),
                };
                for (const [key, value] of Object.entries(instructorData)) {
                    if (!value) {
                        alert(`Please fill in the ${key.replace('_', ' ')}`);
                        return;
                    }
                }
                try {
                    const res = await window.api("/api/instructors", {
                        method: "POST",
                        body: JSON.stringify(instructorData),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!res.success) throw new Error(res.error || "Failed to save instructor");
                    alert("Instructor saved successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            });
        }, 50);
    }

    function openInstructorEditModal(id, data) {
        if(!window.Modal) return;
        if(!window.Modal.el) try { window.Modal.init(); } catch(err){ console.error(err); return; }
        const innerFormHTML = `
            <h2>Edit Instructor</h2>
            <div class="modal-content-form">
                <label>Name</label><input id="ins_name" type="text" value="${data.instructor_name || ''}" required>
                <label>Email</label><input id="ins_email" type="email" value="${data.email || ''}" required>
                <label>Mobile</label><input id="ins_mobile" type="text" value="${data.mobile_no || ''}" required>
                <label>Branch</label><input id="ins_branch" type="text" value="${data.branch || ''}" required>
                <label>Driver Licence</label><input id="ins_license" type="text" value="${data.drivers_license || ''}" required>
                <label>Adhar No</label><input id="ins_adhar" type="text" value="${data.adhar_no || ''}" required>
                <label>Address</label><textarea id="ins_address" required>${data.address || ''}</textarea>
                <button id="saveInstructor" class="btn primary">Save Changes</button>
            </div>
        `;
        window.Modal.setContent(innerFormHTML);
        window.Modal.show();
        setTimeout(() => {
            const saveBtn = document.getElementById("saveInstructor");
            if(!saveBtn) return;
            saveBtn.addEventListener("click", async () => {
                const instructorData = {
                    instructor_name: document.getElementById("ins_name").value.trim(),
                    email: document.getElementById("ins_email").value.trim(),
                    mobile_no: document.getElementById("ins_mobile").value.trim(),
                    branch: document.getElementById("ins_branch").value.trim(),
                    drivers_license: document.getElementById("ins_license").value.trim(),
                    adhar_no: document.getElementById("ins_adhar").value.trim(),
                    address: document.getElementById("ins_address").value.trim(),
                };
                for (const [key, value] of Object.entries(instructorData)) {
                    if (!value) {
                        alert(`Please fill in the ${key.replace('_', ' ')}`);
                        return;
                    }
                }
                try {
                    const res = await window.api(`/api/instructors/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(instructorData),
                        headers: { "Content-Type": "application/json" }
                    });
                    if(!res.success) throw new Error(res.error || "Failed to update instructor");
                    alert("Instructor updated successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            });
        }, 50);
    }

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

    function openBranchAddModal() {
    if (!window.Modal) return;
    if (!window.Modal.el) window.Modal.init();

    const form = `
        <h2>Add Branch</h2>
        <div class="modal-content-form">
            <label>Branch Name</label><input id="br_name" type="text">
            <label>City</label><input id="br_city" type="text">
            <label>State</label><input id="br_state" type="text">
            <label>Mobile</label><input id="br_mobile" type="text">
            <label>Email</label><input id="br_email" type="email">
            <button id="saveBranch" class="btn primary" style="margin-top: 15px;">Save Branch</button>
        </div>
    `;

    window.Modal.setContent(form);
    window.Modal.show();

    setTimeout(() => {
        document.getElementById("saveBranch").onclick = async () => {
            const data = {
                branch_name: br_name.value.trim(),
                city: br_city.value.trim(),
                state: br_state.value.trim(),
                mobile_no: br_mobile.value.trim(),
                email: br_email.value.trim(),
            };

            const res = await window.api("/api/branches", {
                method: "POST",
                body: JSON.stringify(data),
                headers: { "Content-Type": "application/json" }
            });

            if (!res.success) return alert(res.error);
            alert("Branch added!");
            window.Modal.hide();
            tabRenderers[currentTab]();
        };
    }, 30);
}


    function openBranchEditModal(id, data) {
        if (!window.Modal) return;
        if (!window.Modal.el) window.Modal.init();

        const form = `
            <h2>Edit Branch</h2>
            <div class="modal-content-form">
                <label>Branch Name</label><input id="br_name" type="text" value="${data.branch_name}">
                <label>City</label><input id="br_city" type="text" value="${data.city}">
                <label>State</label><input id="br_state" type="text" value="${data.state}">
                <label>Mobile</label><input id="br_mobile" type="text" value="${data.mobile_no}">
                <label>Email</label><input id="br_email" type="email" value="${data.email}">
                <button id="saveBranch" class="btn primary">Save Changes</button>
            </div>
        `;

        window.Modal.setContent(form);
        window.Modal.show();

        setTimeout(() => {
            document.getElementById("saveBranch").onclick = async () => {
                const payload = {
                    branch_name: br_name.value.trim(),
                    city: br_city.value.trim(),
                    state: br_state.value.trim(),
                    mobile_no: br_mobile.value.trim(),
                    email: br_email.value.trim(),
                };

                const res = await window.api(`/api/branches/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                    headers: { "Content-Type": "application/json" }
                });

                if (!res.success) return alert(res.error);
                alert("Branch updated!");
                window.Modal.hide();
                tabRenderers[currentTab]();
            };
        }, 30);
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
