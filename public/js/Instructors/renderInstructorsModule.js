window.renderInstructorsModule = function(tableWrap, tabRenderers, currentTab) {
    return async function() {
        try {
            // -------------------- Fetch Instructors --------------------
            const res = await window.api('/api/instructors');
            if (!res.success) throw new Error(res.error || 'Failed to fetch instructors');

            const rows = res.instructors || [];
            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No instructors found</div>';
                return;
            }

            const scrollTop = window.scrollY || document.documentElement.scrollTop;

            // -------------------- Render Table --------------------
            tableWrap.innerHTML = `
                <table class="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Employee No</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Branch</th>
                            <th>Driver Licence</th>
                            <th>Adhar</th>
                            <th>Address</th>
                            <th>Active</th>
                            <th>Actions</th>
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
                                    <input type="checkbox" class="instructor-active-switch" data-id="${i.id}" ${i.is_active ? 'checked' : ''}>
                                </td>
                                <td>
                                    <button class="btn edit-instructor"
                                        data-id="${i.id}"
                                        data-name="${i.instructor_name}"
                                        data-email="${i.email}"
                                        data-mobile="${i.mobile_no}"
                                        data-branch="${i.branch}"
                                        data-license="${i.drivers_license}"
                                        data-adhar="${i.adhar_no}"
                                        data-address="${i.address}">
                                        Edit
                                    </button>
                                    <button class="btn delete" data-id="${i.id}">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // -------------------- Edit Button --------------------
            tableWrap.querySelectorAll('.edit-instructor').forEach(btn => {
                btn.addEventListener('click', () => {
                    const data = {
                        instructor_name: btn.dataset.name,
                        email: btn.dataset.email,
                        mobile_no: btn.dataset.mobile,
                        branch: btn.dataset.branch,
                        drivers_license: btn.dataset.license,
                        adhar_no: btn.dataset.adhar,
                        address: btn.dataset.address
                    };
                    if (typeof window.openInstructorEditModal === "function") {
                        window.openInstructorEditModal(btn.dataset.id, data, tabRenderers, currentTab)();
                    }
                });
            });


            // -------------------- Active Toggle --------------------
            tableWrap.querySelectorAll('.instructor-active-switch').forEach(switchEl => {
                switchEl.addEventListener('change', async () => {
                    const id = switchEl.dataset.id;
                    const isActive = switchEl.checked;

                    try {
                        const res = await window.api(`/api/instructors/${id}/active`, {
                            method: "PATCH",
                            body: JSON.stringify({ is_active: isActive }),
                            headers: { "Content-Type": "application/json" }
                        });
                        if(!res.success) throw new Error(res.error || "Failed to update status");
                    } catch(err) {
                        alert("Error updating status: " + err.message);
                        switchEl.checked = !isActive; 
                    }
                });
            });

            window.scrollTo(0, scrollTop);

        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    }
};
