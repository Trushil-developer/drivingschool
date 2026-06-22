window.renderInstructorsModule = function(tableWrap, tabRenderers, currentTab) {
    return async function() {

        // -------------------- Sub-tab switcher --------------------
        const subTabBar = document.createElement('div');
        subTabBar.style.cssText = 'display:flex;gap:8px;margin-bottom:20px;border-bottom:2px solid #e5e7eb;padding-bottom:0;';
        subTabBar.innerHTML = `
            <button class="ins-sub-tab ins-sub-active" data-subtab="employees"
                style="padding:8px 18px;border:none;background:none;cursor:pointer;font-weight:600;font-size:14px;border-bottom:2px solid #185fa5;margin-bottom:-2px;color:#185fa5">
                Employees
            </button>
            <button class="ins-sub-tab" data-subtab="leaves"
                style="padding:8px 18px;border:none;background:none;cursor:pointer;font-size:14px;color:#5a6478;margin-bottom:-2px;border-bottom:2px solid transparent">
                Leave Requests
                <span id="leavesPendingBadge" style="display:none;background:#c47f00;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;margin-left:6px;font-weight:700"></span>
            </button>`;

        const existingBar = tableWrap.parentElement.querySelector('.ins-sub-tab-bar');
        if (existingBar) existingBar.remove();
        subTabBar.className = 'ins-sub-tab-bar';
        tableWrap.parentElement.insertBefore(subTabBar, tableWrap);

        const employeesContainer = document.createElement('div');
        const leavesContainer    = document.createElement('div');
        tableWrap.innerHTML = '';
        tableWrap.appendChild(employeesContainer);
        tableWrap.appendChild(leavesContainer);
        leavesContainer.style.display = 'none';

        // Load leave pending count badge
        window.api('/api/admin/leave-requests?status=Pending').then(r => {
            const cnt = (r.requests || []).length;
            const badge = document.getElementById('leavesPendingBadge');
            if (badge && cnt > 0) { badge.textContent = cnt; badge.style.display = 'inline'; }
        }).catch(() => {});

        // Sub-tab click handler
        subTabBar.querySelectorAll('.ins-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                subTabBar.querySelectorAll('.ins-sub-tab').forEach(b => {
                    b.style.color = '#5a6478'; b.style.borderBottom = '2px solid transparent'; b.style.fontWeight = '400';
                });
                btn.style.color = '#185fa5'; btn.style.borderBottom = '2px solid #185fa5'; btn.style.fontWeight = '600';
                if (btn.dataset.subtab === 'employees') {
                    employeesContainer.style.display = ''; leavesContainer.style.display = 'none';
                } else {
                    employeesContainer.style.display = 'none'; leavesContainer.style.display = '';
                    if (window.renderLeaveRequestsTab) window.renderLeaveRequestsTab(leavesContainer)();
                }
            });
        });

        // ---- Employees sub-tab ----
        try {
            const res = await window.api('/api/instructors');
            if (!res.success) throw new Error(res.error || 'Failed to fetch employees');

            const rows = res.instructors || [];
            if (!rows.length) {
                employeesContainer.innerHTML = '<div class="empty">No employees found</div>';
                return;
            }

            const scrollTop = window.scrollY || document.documentElement.scrollTop;

            // -------------------- Render Table --------------------
            employeesContainer.innerHTML = `
                <table class="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Employee No</th>
                            <th>Name</th>
                            <th>Role</th>
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
                                <td><span class="role-badge role-${(i.role || 'instructor').toLowerCase().replace(' ', '-')}">${i.role || 'Instructor'}</span></td>
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
                                        data-role="${i.role || 'Instructor'}"
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
            employeesContainer.querySelectorAll('.edit-instructor').forEach(btn => {
                btn.addEventListener('click', () => {
                    const data = {
                        instructor_name: btn.dataset.name,
                        role: btn.dataset.role,
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
            employeesContainer.querySelectorAll('.instructor-active-switch').forEach(switchEl => {
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
            employeesContainer.innerHTML = `<div class="error">${err.message}</div>`;
        }
    }
};
