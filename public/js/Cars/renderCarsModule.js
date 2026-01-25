function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

window.renderCarsModule = function (tableWrap, tabRenderers, currentTab) {
    return async function () {
        try {
            const res = await window.api("/api/cars");
            if (!res.success) throw new Error(res.error || "Failed to fetch cars");

            const rows = res.cars || [];

            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No cars found</div>';
                return;
            }

            tableWrap.innerHTML = `
                <table class="cars-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Car Name</th>
                            <th>Tag</th>
                            <th>Branch</th>
                            <th>Registration No</th>
                            <th>15 Days Price</th>
                            <th>21 Days Price</th>
                            <th>Active</th>
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
                                <td>
                                    ${c.tag ? `<span class="tag-pill">${c.tag}</span>` : '-'}
                                </td>
                                <td>${c.branch || '-'}</td>
                                <td>${c.car_registration_no || '-'}</td>
                                <td>₹ ${c.price_15_days ?? '0.00'}</td>
                                <td>₹ ${c.price_21_days ?? '0.00'}</td>
                                <td>
                                    <input type="checkbox" class="car-active-switch" data-id="${c.id}" ${c.inactive ? '' : 'checked'}>
                                </td>
                                <td>
                                    <button class="btn edit"
                                        data-id="${c.id}"
                                        data-name="${c.car_name || ''}"
                                        data-tag="${c.tag || ''}"
                                        data-branch="${c.branch || ''}"
                                        data-car_registration_no="${c.car_registration_no || ''}"
                                        data-insurance_policy_no="${c.insurance_policy_no || ''}"
                                        data-insurance_company="${c.insurance_company || ''}"
                                        data-insurance_issue_date="${c.insurance_issue_date || ''}"
                                        data-insurance_expiry_date="${c.insurance_expiry_date || ''}"
                                        data-puc_issue_date="${c.puc_issue_date || ''}"
                                        data-puc_expiry_date="${c.puc_expiry_date || ''}"
                                        data-price_15_days="${c.price_15_days ?? 0}"
                                        data-price_21_days="${c.price_21_days ?? 0}"
                                    >Edit</button>
                                    <button class="btn delete" data-id="${c.id}">Delete</button>
                                </td>
                            </tr>

                            <tr class="car-details hidden" id="details-${c.id}">
                                <td colspan="8">
                                    <strong>Tag:</strong> ${c.tag || '-'} <br>
                                    <strong>15 Days Price:</strong> ₹ ${c.price_15_days ?? '0.00'} <br>
                                    <strong>21 Days Price:</strong> ₹ ${c.price_21_days ?? '0.00'} <br>
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

            // -----------------------------
            // Attach Edit button listeners
            // -----------------------------
            tableWrap.querySelectorAll('.btn.edit').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;

                    const carData = {
                        car_name: btn.dataset.name,
                        tag: btn.dataset.tag,
                        branch: btn.dataset.branch,
                        car_registration_no: btn.dataset.car_registration_no,
                        insurance_policy_no: btn.dataset.insurance_policy_no,
                        insurance_company: btn.dataset.insurance_company,
                        insurance_issue_date: btn.dataset.insurance_issue_date,
                        insurance_expiry_date: btn.dataset.insurance_expiry_date,
                        puc_issue_date: btn.dataset.puc_issue_date,
                        puc_expiry_date: btn.dataset.puc_expiry_date,
                        price_15_days: btn.dataset.price_15_days,
                        price_21_days: btn.dataset.price_21_days
                    };

                    const openModal = window.openCarEditModal(id, carData, tabRenderers, currentTab);
                    openModal();
                });
            });

            // -----------------------------
            // Toggle car details
            // -----------------------------
            tableWrap.querySelectorAll('.car-name').forEach(cell => {
                cell.addEventListener('click', () => {
                    const tr = cell.parentElement;
                    const id = tr.dataset.id;
                    const detailsRow = document.getElementById(`details-${id}`);
                    if (detailsRow) detailsRow.classList.toggle('hidden');
                });
            });

            // -----------------------------
            // Active / Inactive toggle
            // -----------------------------
            tableWrap.querySelectorAll('.car-active-switch').forEach(switchEl => {
                switchEl.addEventListener('change', async () => {
                    const id = switchEl.dataset.id;
                    const inactive = switchEl.checked ? 0 : 1; 

                    try {
                        const res = await window.api(`/api/cars/${id}/active`, {
                            method: "PATCH",
                            body: JSON.stringify({ inactive }),
                            headers: { "Content-Type": "application/json" },
                        });

                        if (!res.success) throw new Error(res.error || "Failed to update status");
                    } catch (err) {
                        alert("Error updating status: " + err.message);
                        switchEl.checked = !switchEl.checked; 
                    }
                });
            });

        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    }
};
