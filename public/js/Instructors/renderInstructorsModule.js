window.renderInstructorsModule = function(tableWrap, tabRenderers, currentTab) {
    return async function() {

        // -------------------- Sub-tab switcher --------------------
        const subTabBar = document.createElement('div');
        subTabBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;border-bottom:2px solid #e5e7eb;padding-bottom:0;';
        subTabBar.innerHTML = `
            <button class="ins-sub-tab ins-sub-active" data-subtab="attendance"
                style="padding:8px 18px;border:none;background:none;cursor:pointer;font-weight:600;font-size:14px;border-bottom:2px solid #185fa5;margin-bottom:-2px;color:#185fa5">
                Attendance
            </button>
            <button class="ins-sub-tab" data-subtab="employees"
                style="padding:8px 18px;border:none;background:none;cursor:pointer;font-size:14px;color:#5a6478;margin-bottom:-2px;border-bottom:2px solid transparent">
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

        // Always hide the global header Add button for this tab
        const globalAddBtn = document.getElementById('addBtn');
        if (globalAddBtn) globalAddBtn.classList.add('hidden');

        // Local actions bar — Add Employee button lives here, below the tab bar
        const existingActions = tableWrap.parentElement.querySelector('.ins-actions-bar');
        if (existingActions) existingActions.remove();
        const actionsBar = document.createElement('div');
        actionsBar.className = 'ins-actions-bar';
        actionsBar.style.cssText = 'display:none;margin-bottom:16px;';
        actionsBar.innerHTML = `
            <button id="insAddEmployeeBtn"
                style="padding:8px 18px;background:#185fa5;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">
                + Add Employee
            </button>`;
        tableWrap.parentElement.insertBefore(actionsBar, tableWrap);

        const employeesContainer  = document.createElement('div');
        const leavesContainer     = document.createElement('div');
        const attendanceContainer = document.createElement('div');
        tableWrap.innerHTML = '';
        tableWrap.appendChild(attendanceContainer);
        tableWrap.appendChild(employeesContainer);
        tableWrap.appendChild(leavesContainer);
        employeesContainer.style.display = 'none';
        leavesContainer.style.display    = 'none';

        // Load leave pending count badge
        window.api('/api/admin/leave-requests?status=Pending').then(r => {
            const cnt = (r.requests || []).length;
            const badge = document.getElementById('leavesPendingBadge');
            if (badge && cnt > 0) { badge.textContent = cnt; badge.style.display = 'inline'; }
        }).catch(() => {});

        // Wire local Add Employee button
        actionsBar.querySelector('#insAddEmployeeBtn')?.addEventListener('click', () => {
            if (window.openInstructorAddModal) window.openInstructorAddModal(tabRenderers, currentTab)();
        });

        // Sub-tab click handler
        subTabBar.querySelectorAll('.ins-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                subTabBar.querySelectorAll('.ins-sub-tab').forEach(b => {
                    b.style.color = '#5a6478'; b.style.borderBottom = '2px solid transparent'; b.style.fontWeight = '400';
                });
                btn.style.color = '#185fa5'; btn.style.borderBottom = '2px solid #185fa5'; btn.style.fontWeight = '600';
                if (btn.dataset.subtab === 'employees') {
                    attendanceContainer.style.display = 'none';
                    leavesContainer.style.display     = 'none';
                    employeesContainer.style.display  = '';
                    actionsBar.style.display          = '';
                } else if (btn.dataset.subtab === 'leaves') {
                    attendanceContainer.style.display = 'none';
                    employeesContainer.style.display  = 'none';
                    actionsBar.style.display          = 'none';
                    leavesContainer.style.display     = '';
                    if (window.renderLeaveRequestsTab) window.renderLeaveRequestsTab(leavesContainer)();
                } else {
                    employeesContainer.style.display  = 'none';
                    leavesContainer.style.display     = 'none';
                    actionsBar.style.display          = 'none';
                    attendanceContainer.style.display = '';
                    if (window.renderAttendanceTab) window.renderAttendanceTab(attendanceContainer)();
                }
            });
        });

        // Load attendance immediately (it's the default active sub-tab)
        if (window.renderAttendanceTab) window.renderAttendanceTab(attendanceContainer)();

        // ---- Employees sub-tab (loaded lazily when clicked) ----
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
