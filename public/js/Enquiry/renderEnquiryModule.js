window.renderEnquiryModule = async function(tableWrap) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    function showLoading() {
        tableWrap.innerHTML = `<div class="loading-overlay">Loading...</div>`;
    }

    function hideLoading() {
        const overlay = tableWrap.querySelector('.loading-overlay');
        if (overlay) overlay.remove();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    async function fetchEnquiries() {
        showLoading();
        try {
            const res = await window.api('/api/enquiries');
            if (!res.success) throw new Error(res.error || 'Failed to fetch enquiries');

            const enquiries = res.enquiries || [];
            if (!enquiries.length) {
                tableWrap.innerHTML = '<div class="empty">No enquiries found</div>';
                return;
            }

            const html = `
                <table class="enquiries-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Branch</th>
                            <th>Course</th>
                            <th>Has Licence</th>
                            <th>Message</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${enquiries.map(e => `
                            <tr id="enquiry-${e.id}">
                                <td>${e.id}</td>
                                <td>${e.full_name || '-'}</td>
                                <td>${e.email || '-'}</td>
                                <td>${e.phone || '-'}</td>
                                <td>${e.branch_name || '-'}</td>
                                <td>${e.course_name || '-'}</td>
                                <td>${e.has_licence || '-'}</td>
                                <td>${e.message || '-'}</td>
                                <td>${e.created_at ? formatDate(e.created_at) : '-'}</td>
                                <td>
                                    <button class="btn delete" data-id="${e.id}">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            tableWrap.innerHTML = html;
        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        } finally {
            hideLoading();
        }
    }

    if (!tableWrap.dataset.listenerAttached) {
        tableWrap.addEventListener('click', async e => {
            const id = e.target.dataset.id;
            if (!id || !e.target.classList.contains('delete')) return;

            const pwd = prompt("Enter admin password to delete:");
            if (!pwd) return alert("Deletion cancelled");
            if (pwd !== "1234") return alert("Incorrect password!");

            try {
                const res = await window.api(`/api/enquiries/${id}`, { method: "DELETE" });
                if (!res.success) return alert(res.error || "Delete failed");

                alert("Deleted successfully!");
                fetchEnquiries();
            } catch (err) {
                console.error(err);
                alert("Error deleting enquiry");
            }
        });
        tableWrap.dataset.listenerAttached = "true"; 
    }

    await fetchEnquiries();
};
