window.renderEnquiryModule = async function (tableWrap) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    function showLoading() {
        tableWrap.innerHTML = `<div class="loading-overlay">Loading...</div>`;
    }

    function hideLoading() {
        const overlay = tableWrap.querySelector(".loading-overlay");
        if (overlay) overlay.remove();
    }

    function formatDate(dateStr) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function renderEnquiryRows(data) {
        const tbody = tableWrap.querySelector(".enquiries-table tbody");

        if (!data.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="empty">No enquiries found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(e => `
            <tr id="enquiry-${e.id}">
                <td>${e.id}</td>
                <td>${e.full_name || "-"}</td>
                <td>${e.email || "-"}</td>
                <td>${e.phone || "-"}</td>
                <td>${e.branch_name || "-"}</td>
                <td>${e.course_name || "-"}</td>
                <td>${e.has_licence || "-"}</td>
                <td>${e.hear_about || "-"}</td>
                <td>${e.message || "-"}</td>
                <td>${e.created_at ? formatDate(e.created_at) : "-"}</td>
                <td>
                    <button class="btn delete" data-id="${e.id}">Delete</button>
                </td>
            </tr>
        `).join("");
    }

    async function fetchEnquiries() {
        showLoading();

        try {
            const res = await window.api("/api/enquiries");
            if (!res.success) throw new Error(res.error || "Failed to fetch enquiries");

            let enquiries = res.enquiries || [];

            if (!enquiries.length) {
                tableWrap.innerHTML = `<div class="empty">No enquiries found</div>`;
                return;
            }

            // ---------- Build filter & table ----------
            const branchFilterHTML = `
                <div class="filter-bar">
                    <label>
                        Branch:
                        <select id="enquiryBranchFilter">
                            <option value="">All</option>
                        </select>
                    </label>
                </div>
            `;

            const tableHTML = `
                <table class="enquiries-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Branch</th>
                            <th>Course</th>
                            <th>Licence</th>
                            <th>Heard About</th>
                            <th>Message</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            `;

            tableWrap.innerHTML = branchFilterHTML + tableHTML;

            const branchSelect = document.getElementById("enquiryBranchFilter");

            // ---------- Populate branch filter ----------
            try {
                const branchRes = await window.api("/api/branches");
                if (branchRes.success && branchRes.branches) {
                    branchRes.branches.forEach(b => {
                        const opt = document.createElement("option");
                        opt.value = b.branch_name;
                        opt.textContent = b.branch_name;
                        branchSelect.appendChild(opt);
                    });
                }
            } catch (err) {
                console.error("Failed to load branches", err);
            }

            // ---------- Initial render ----------
            renderEnquiryRows(enquiries);

            // ---------- Filter listener ----------
            branchSelect?.addEventListener("change", () => {
                const selectedBranch = branchSelect.value;
                const filtered = selectedBranch
                    ? enquiries.filter(e => e.branch_name === selectedBranch)
                    : enquiries;

                renderEnquiryRows(filtered);
            });
        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        } finally {
            hideLoading();
        }
    }

    // ---------- DELETE HANDLER (ONCE) ----------
    if (!tableWrap.dataset.listenerAttached) {
        tableWrap.addEventListener("click", async e => {
            const btn = e.target;
            if (!btn.classList.contains("delete")) return;

            const id = btn.dataset.id;
            if (!id) return;

            const pwd = prompt("Enter admin password to delete:");
            if (!pwd) return alert("Deletion cancelled");
            if (pwd !== "1234") return alert("Incorrect password!");

            try {
                const res = await window.api(`/api/enquiries/${id}`, {
                    method: "DELETE"
                });

                if (!res.success) {
                    alert(res.error || "Delete failed");
                    return;
                }

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
