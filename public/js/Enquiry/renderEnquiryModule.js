window.renderEnquiryModule = async function (tableWrap) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const ACTION_TYPES = ["Call", "Note", "Email", "Meeting", "WhatsApp", "Other"];
    const STATUS_OPTIONS = ["New", "Called", "Interested", "Not Interested", "Converted", "Follow Up"];

    const STATUS_COLORS = {
        "New":           { bg: "#EFF6FF", color: "#1D4ED8" },
        "Called":        { bg: "#F0FDF4", color: "#15803D" },
        "Interested":    { bg: "#FEF9C3", color: "#92400E" },
        "Not Interested":{ bg: "#FEF2F2", color: "#B91C1C" },
        "Converted":     { bg: "#F0FDF4", color: "#166534" },
        "Follow Up":     { bg: "#FFF7ED", color: "#C2410C" }
    };

    const ACTION_ICONS = {
        "Call":      "📞",
        "Note":      "📝",
        "Email":     "✉️",
        "Meeting":   "🤝",
        "WhatsApp":  "💬",
        "Other":     "📌"
    };

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

    function formatDateTime(dateStr) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return `${date} ${time}`;
    }

    function statusBadge(status) {
        const s = status || "New";
        const c = STATUS_COLORS[s] || STATUS_COLORS["New"];
        return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;">${s}</span>`;
    }

    function renderEnquiryRows(data) {
        const tbody = tableWrap.querySelector(".enquiries-table tbody");

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="12" class="empty">No enquiries found</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(e => `
            <tr id="enquiry-${e.id}">
                <td>${e.id}</td>
                <td><strong>${e.full_name || "-"}</strong></td>
                <td>${e.phone || "-"}</td>
                <td>${e.email || "-"}</td>
                <td>${e.branch_name || "-"}</td>
                <td>${e.course_name || "-"}</td>
                <td>${e.has_licence || "-"}</td>
                <td>${e.hear_about || "-"}</td>
                <td>${statusBadge(e.status)}</td>
                <td>${e.created_at ? formatDate(e.created_at) : "-"}</td>
                <td>
                    <button class="btn btn-actions" data-id="${e.id}" data-name="${e.full_name || ''}" title="View/Add Actions">
                        Actions ${e.action_count > 0 ? `<span style="background:#3B82F6;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px;">${e.action_count}</span>` : ""}
                    </button>
                    <button class="btn delete" data-id="${e.id}">Delete</button>
                </td>
            </tr>
        `).join("");
    }

    // ===================== ACTIONS MODAL =====================
    async function openActionsModal(enquiryId, enquiryName) {
        function renderModal(actions, loading = false) {
            const timelineHTML = loading
                ? `<div style="text-align:center;padding:20px;color:#888;">Loading...</div>`
                : actions.length === 0
                    ? `<div style="text-align:center;padding:20px;color:#888;">No actions yet. Add the first one below.</div>`
                    : actions.map(a => `
                        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;">
                            <div style="font-size:22px;flex-shrink:0;margin-top:2px;">${ACTION_ICONS[a.action_type] || "📌"}</div>
                            <div style="flex:1;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:10px 14px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                    <span style="font-weight:600;color:#111;">${a.action_type}</span>
                                    <span style="font-size:11px;color:#888;">${formatDateTime(a.action_date)}</span>
                                </div>
                                <div style="color:#374151;margin-bottom:6px;">${a.note}</div>
                                <div style="font-size:11px;color:#6B7280;">By: <strong>${a.action_by}</strong></div>
                            </div>
                            <button class="btn-del-action" data-action-id="${a.id}" style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:16px;padding:4px;" title="Delete action">✕</button>
                        </div>
                    `).join("");

            return `
                <div style="padding:0 4px;">
                    <h3 style="margin:0 0 4px;font-size:16px;">Actions for: <span style="color:#3B82F6;">${enquiryName}</span></h3>
                    <p style="margin:0 0 16px;font-size:12px;color:#888;">Enquiry #${enquiryId}</p>

                    <!-- Timeline -->
                    <div id="actions-timeline" style="max-height:320px;overflow-y:auto;margin-bottom:20px;padding-right:4px;">
                        ${timelineHTML}
                    </div>

                    <!-- Add Action Form -->
                    <div style="border-top:1px solid #E5E7EB;padding-top:16px;">
                        <div style="font-weight:600;margin-bottom:12px;color:#111;">Add New Action</div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Type</label>
                                <select id="act-type" style="width:100%;padding:7px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;">
                                    ${ACTION_TYPES.map(t => `<option value="${t}">${ACTION_ICONS[t]} ${t}</option>`).join("")}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Done By</label>
                                <input id="act-by" type="text" placeholder="Staff name..." style="width:100%;padding:7px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;box-sizing:border-box;" />
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Date & Time</label>
                                <input id="act-date" type="datetime-local" style="width:100%;padding:7px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;box-sizing:border-box;"
                                    value="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}" />
                            </div>
                            <div>
                                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Update Status</label>
                                <select id="act-status" style="width:100%;padding:7px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;">
                                    <option value="">No change</option>
                                    ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join("")}
                                </select>
                            </div>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Note *</label>
                            <textarea id="act-note" placeholder="What was discussed / what happened..." rows="3"
                                style="width:100%;padding:7px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
                        </div>

                        <button id="btn-add-action" style="background:#3B82F6;color:#fff;border:none;border-radius:6px;padding:9px 20px;font-size:13px;cursor:pointer;font-weight:600;">
                            Add Action
                        </button>
                    </div>
                </div>
            `;
        }

        // Renders modal content and re-attaches ALL handlers
        async function refreshModal(lastStatus) {
            const refreshed = await window.api(`/api/enquiries/${enquiryId}/actions`);
            const freshActions = refreshed.success ? refreshed.actions : [];

            window.Modal.setContent(renderModal(freshActions));
            bindAddButton();
            reAttachHandlers(enquiryId, enquiryName);

            // Update status badge in the table row
            if (lastStatus) {
                const row = document.getElementById(`enquiry-${enquiryId}`);
                if (row) {
                    const statusCell = row.cells[8];
                    if (statusCell) statusCell.innerHTML = statusBadge(lastStatus);
                }
            }

            // Update action count badge on the table button
            const actBtn = document.querySelector(`button.btn-actions[data-id="${enquiryId}"]`);
            if (actBtn) {
                const count = freshActions.length;
                actBtn.innerHTML = `Actions <span style="background:#3B82F6;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px;">${count}</span>`;
            }
        }

        // Binds the Add Action button — must be called after every setContent
        function bindAddButton() {
            const addBtn = document.getElementById("btn-add-action");
            if (!addBtn) return;

            addBtn.addEventListener("click", async () => {
                const type = document.getElementById("act-type").value;
                const by = document.getElementById("act-by").value.trim();
                const note = document.getElementById("act-note").value.trim();
                const date = document.getElementById("act-date").value;
                const status = document.getElementById("act-status").value;

                if (!by) return alert("Please enter who performed this action");
                if (!note) return alert("Please enter a note");

                addBtn.disabled = true;
                addBtn.textContent = "Saving...";

                try {
                    const res = await window.api(`/api/enquiries/${enquiryId}/actions`, {
                        method: "POST",
                        body: JSON.stringify({ action_type: type, note, action_by: by, action_date: date, status: status || null })
                    });

                    if (!res.success) {
                        alert(res.message || "Failed to add action");
                        addBtn.disabled = false;
                        addBtn.textContent = "Add Action";
                        return;
                    }

                    await refreshModal(status);
                } catch (e) {
                    alert("Error saving action");
                    addBtn.disabled = false;
                    addBtn.textContent = "Add Action";
                }
            });
        }

        // Show modal with loading state
        window.Modal.setContent(renderModal([], true));
        window.Modal.show();

        // Fetch existing actions then render fully
        await refreshModal(null);
    }

    function reAttachHandlers(enquiryId, enquiryName) {
        document.querySelectorAll(".btn-del-action").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (!confirm("Delete this action?")) return;
                const actionId = btn.dataset.actionId;
                await window.api(`/api/enquiries/${enquiryId}/actions/${actionId}`, { method: "DELETE" });
                openActionsModal(enquiryId, enquiryName);
            });
        });
    }

    // ===================== FETCH + BUILD TABLE =====================
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

            const branchFilterHTML = `
                <div class="filter-bar" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
                        Branch:
                        <select id="enquiryBranchFilter" style="padding:5px 8px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;">
                            <option value="">All</option>
                        </select>
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
                        Status:
                        <select id="enquiryStatusFilter" style="padding:5px 8px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;">
                            <option value="">All</option>
                            ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join("")}
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
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Branch</th>
                            <th>Course</th>
                            <th>Licence</th>
                            <th>Heard About</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            `;

            tableWrap.innerHTML = branchFilterHTML + tableHTML;

            const branchSelect = document.getElementById("enquiryBranchFilter");
            const statusSelect = document.getElementById("enquiryStatusFilter");

            // Populate branch filter
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

            function applyFilters() {
                const branch = branchSelect.value;
                const status = statusSelect.value;
                let filtered = enquiries;
                if (branch) filtered = filtered.filter(e => e.branch_name === branch);
                if (status) filtered = filtered.filter(e => (e.status || "New") === status);
                renderEnquiryRows(filtered);
            }

            renderEnquiryRows(enquiries);

            branchSelect?.addEventListener("change", applyFilters);
            statusSelect?.addEventListener("change", applyFilters);

        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        } finally {
            hideLoading();
        }
    }

    // ===================== EVENT DELEGATION =====================
    if (!tableWrap.dataset.listenerAttached) {
        tableWrap.addEventListener("click", async e => {
            const btn = e.target.closest("button");
            if (!btn) return;

            // Actions button
            if (btn.classList.contains("btn-actions")) {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                openActionsModal(id, name);
                return;
            }

            // Delete button
            if (btn.classList.contains("delete")) {
                const id = btn.dataset.id;
                if (!id) return;

                const pwd = prompt("Enter admin password to delete:");
                if (!pwd) return alert("Deletion cancelled");
                if (pwd !== "1234") return alert("Incorrect password!");

                try {
                    const res = await window.api(`/api/enquiries/${id}`, { method: "DELETE" });
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
            }
        });

        tableWrap.dataset.listenerAttached = "true";
    }

    await fetchEnquiries();
};
