function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

window.renderPackagesModule = function(tableWrap, tabRenderers, currentTab) {
    return async function() {
        try {
            const res = await window.api("/api/packages");
            if (!res.success) throw new Error(res.error || "Failed to fetch packages");

            const rows = res.packages || [];

            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No packages found</div>';
                return;
            }

            // Render table
            tableWrap.innerHTML = `
                <table class="packages-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Badge</th>
                            <th>Title</th>
                            <th>Sessions</th>
                            <th>Duration</th>
                            <th>Distance</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(pkg => {
                            // Parse extra features if JSON
                            let extraFeatures = [];
                            if (pkg.extra_features) {
                                try {
                                    const featuresObj = typeof pkg.extra_features === 'string'
                                        ? JSON.parse(pkg.extra_features)
                                        : pkg.extra_features;
                                    extraFeatures = Object.values(featuresObj);
                                } catch (err) {
                                    console.error('Invalid JSON for package extra_features', err);
                                }
                            }

                            return `
                            <tr class="package-row" data-id="${pkg.id}">
                                <td>${pkg.id}</td>
                                <td>${pkg.badge || '-'}</td>
                                <td class="package-title" style="cursor:pointer; color:blue; text-decoration:underline;">
                                    ${pkg.title || '-'}
                                </td>
                                <td>${pkg.practical_sessions || '-'}</td>
                                <td>${pkg.session_duration || '-'}</td>
                                <td>${pkg.daily_distance || '-'}</td>
                                <td class="actions-cell">
                                    <button class="btn edit"
                                        data-id="${pkg.id}"
                                        data-badge="${pkg.badge || ''}"
                                        data-title="${pkg.title || ''}"
                                        data-description="${(pkg.description || '').replace(/"/g, '&quot;')}"
                                        data-practical_sessions="${pkg.practical_sessions || ''}"
                                        data-session_duration="${pkg.session_duration || ''}"
                                        data-daily_distance="${pkg.daily_distance || ''}"
                                        data-extra_features='${JSON.stringify(extraFeatures)}'>
                                        Edit
                                    </button>
                                    <button class="btn delete" data-id="${pkg.id}">Delete</button>
                                </td>
                            </tr>
                            <tr class="package-details hidden" id="details-${pkg.id}">
                                <td colspan="7">
                                    <strong>Description:</strong> ${pkg.description || '-'} <br>
                                    ${extraFeatures.length > 0 ? `
                                        <strong>Extra Features:</strong>
                                        <ul>
                                            ${extraFeatures.map(f => `<li>${f}</li>`).join('')}
                                        </ul>
                                    ` : ''}
                                </td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            `;

            // Toggle description row
            tableWrap.querySelectorAll('.package-title').forEach(cell => {
                cell.addEventListener('click', () => {
                    const tr = cell.parentElement;
                    const id = tr.dataset.id;
                    const detailsRow = document.getElementById(`details-${id}`);
                    if (detailsRow) detailsRow.classList.toggle('hidden');
                });
            });

            // Edit button
            tableWrap.querySelectorAll('.btn.edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;

                    let extraFeatures = [];
                    try {
                        extraFeatures = JSON.parse(btn.dataset.extra_features || '[]');
                    } catch (err) {
                        console.error('Error parsing extra_features:', err);
                    }

                    const packageData = {
                        badge: btn.dataset.badge,
                        title: btn.dataset.title,
                        description: btn.dataset.description,
                        practical_sessions: btn.dataset.practical_sessions,
                        session_duration: btn.dataset.session_duration,
                        daily_distance: btn.dataset.daily_distance,
                        extra_features: extraFeatures
                    };
                    window.openPackageEditModal(id, packageData, tabRenderers, currentTab)();
                });
            });

        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    };
};
