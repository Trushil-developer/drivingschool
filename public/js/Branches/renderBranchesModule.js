window.renderBranchesModule = function (tableWrap) {
    return async function () {
        try {
            const res = await window.api("/api/branches");
            if (!res.success) throw new Error(res.error || "Failed to fetch branches");

            const rows = res.branches || [];
            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No branches found</div>';
                return;
            }

            // Build HTML table
            tableWrap.innerHTML = `
                <table class="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Branch Name</th>
                            <th>City</th>
                            <th>State</th>
                            <th>Mobile</th>
                            <th>Email</th>
                            <th>WiFi SSID</th>
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
                                <td>${b.wifi_ssid || '-'}</td>
                                <td>
                                    <button class="btn edit-branch"
                                        data-id="${b.id}"
                                        data-name="${b.branch_name}"
                                        data-city="${b.city}"
                                        data-state="${b.state}"
                                        data-mobile="${b.mobile_no}"
                                        data-email="${b.email}"
                                        data-wifi="${b.wifi_ssid || ''}">
                                        Edit
                                    </button>
                                    <button class="btn delete" data-id="${b.id}">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Attach event listeners for edit buttons
            tableWrap.querySelectorAll('.edit-branch').forEach(btn => {
                btn.addEventListener('click', () => {
                    const data = {
                        branch_name: btn.dataset.name,
                        city: btn.dataset.city,
                        state: btn.dataset.state,
                        mobile_no: btn.dataset.mobile,
                        email: btn.dataset.email,
                        wifi_ssid: btn.dataset.wifi,
                    };
                    if (typeof window.openBranchEditModal === "function") {
                        window.openBranchEditModal(btn.dataset.id, data)();
                    }
                });
            });

        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    }
}
