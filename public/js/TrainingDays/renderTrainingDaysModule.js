window.renderTrainingDaysModule = function (tableWrap) {
    return async function() {
        try {
            const res = await window.api("/api/training-days");
            if (!res.success) throw new Error(res.error || "Failed to fetch training days");

            const rows = res.training_days || [];
            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No training days found</div>';
                return;
            }

            // HTML for table with toggle switch
            tableWrap.innerHTML = `
                <style>
                    .switch {
                        position: relative;
                        display: inline-block;
                        width: 50px;
                        height: 24px;
                    }
                    .switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    .slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0; left: 0;
                        right: 0; bottom: 0;
                        background-color: #ccc;
                        transition: 0.4s;
                        border-radius: 24px;
                    }
                    .slider:before {
                        position: absolute;
                        content: "";
                        height: 20px;
                        width: 20px;
                        left: 2px;
                        bottom: 2px;
                        background-color: white;
                        transition: 0.4s;
                        border-radius: 50%;
                    }
                    input:checked + .slider {
                        background-color: #4CAF50;
                    }
                    input:checked + .slider:before {
                        transform: translateX(26px);
                    }
                </style>

                <table class="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Days</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(td => `
                            <tr id="td-${td.id}">
                                <td>${td.id}</td>
                                <td>${td.days}</td>
                                <td>
                                    <label class="switch">
                                        <input type="checkbox" class="td-active-toggle" data-id="${td.id}" ${td.is_active ? 'checked' : ''}>
                                        <span class="slider"></span>
                                    </label>
                                </td>
                                <td>
                                    <button class="btn delete" data-id="${td.id}">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            tableWrap.querySelectorAll('.td-active-toggle').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    const id = e.target.dataset.id;
                    const isActive = e.target.checked ? 1 : 0;
                    try {
                        const res = await window.api(`/api/training-days/${id}/toggle`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ is_active: isActive })
                        });
                        if (!res.success) throw new Error(res.error || "Failed to update status");
                    } catch(err) {
                        alert("Error: " + err.message);
                        e.target.checked = !e.target.checked; 
                    }
                });
            });

        } catch(err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    }
}
