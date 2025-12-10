function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

window.renderCoursesModule = function(tableWrap, tabRenderers, currentTab) {
    return async function() {
        try {
            const res = await window.api("/api/courses");
            if (!res.success) throw new Error(res.error || "Failed to fetch courses");

            const rows = res.courses || [];

            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No courses found</div>';
                return;
            }

            // Render table
            tableWrap.innerHTML = `
                <table class="courses-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Course Name</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(c => `
                            <tr class="course-row" data-id="${c.id}">
                                <td>${c.id}</td>
                                <td class="course-name" style="cursor:pointer; color:blue; text-decoration:underline;">
                                    ${c.course_name || '-'}
                                </td>
                                <td>
                                    <input type="checkbox" class="course-status-switch" data-id="${c.id}" ${c.status === 'active' ? 'checked' : ''}>
                                </td>
                                <td>${formatDate(c.created_at)}</td>
                                <td class="actions-cell">
                                    <button class="btn edit" data-id="${c.id}" data-course_name="${c.course_name || ''}" data-description="${c.description || ''}" data-status="${c.status || 'active'}">Edit</button>
                                    <button class="btn delete" data-id="${c.id}">Delete</button>
                                </td>
                            </tr>
                            <tr class="course-details hidden" id="details-${c.id}">
                                <td colspan="5">
                                    <strong>Description:</strong> ${c.description || '-'} <br>
                                    <strong>Created:</strong> ${formatDate(c.created_at)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Toggle description row
            tableWrap.querySelectorAll('.course-name').forEach(cell => {
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
                    const courseData = {
                        course_name: btn.dataset.course_name,
                        description: btn.dataset.description,
                        status: btn.dataset.status
                    };
                    window.openCourseEditModal(id, courseData, tabRenderers, currentTab)();
                });
            });

            // Status toggle (active/inactive)
            tableWrap.querySelectorAll('.course-status-switch').forEach(switchEl => {
                switchEl.addEventListener('change', async () => {
                    const id = switchEl.dataset.id;
                    const status = switchEl.checked ? 'active' : 'inactive';
                    try {
                        const res = await window.api(`/api/courses/${id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ status }),
                            headers: { "Content-Type": "application/json" },
                        });
                        if (!res.success) throw new Error(res.error || "Failed to update status");
                    } catch (err) {
                        alert("Error updating course status: " + err.message);
                        switchEl.checked = !switchEl.checked; // revert
                    }
                });
            });

        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    };
};
