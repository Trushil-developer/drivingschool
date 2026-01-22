function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

window.renderCMSModule = function (tableWrap, tabRenderers, currentTab) {
    return async function () {
        try {
            const res = await window.api("/api/cms");
            if (!res.success) throw new Error(res.error || "Failed to fetch CMS pages");

            const rows = res.pages || [];

            if (!rows.length) {
                tableWrap.innerHTML = '<div class="empty">No CMS pages found</div>';
                return;
            }

            tableWrap.innerHTML = `
                <table class="cms-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Page</th>
                            <th>Updated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(p => `
                            <tr class="cms-row" data-id="${p.id}" data-slug="${p.slug}">
                                <td><span class="cms-id">${p.id}</span></td>
                                <td class="cms-title">${p.title}</td>
                                <td>${formatDate(p.updated_at)}</td>
                                <td class="cms-actions">
                                    <button class="btn view">View</button>
                                    <button class="btn edit">Edit</button>
                                </td>
                            </tr>
                            <tr class="cms-details hidden" id="cms-${p.slug}">
                                <td colspan="5">
                                    <div class="cms-content-wrapper">
                                        <div class="cms-content">Loading...</div>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            /* ============================
               VIEW CONTENT
            ============================ */
            tableWrap.querySelectorAll(".btn.view, .cms-title").forEach(el => {
                el.addEventListener("click", async () => {
                    const row = el.closest(".cms-row");
                    const slug = row.dataset.slug;
                    const detailsRow = document.getElementById(`cms-${slug}`);
                    const wrapper = detailsRow.querySelector(".cms-content-wrapper");

                    detailsRow.classList.remove("hidden");

                    // Always load fresh VIEW content
                    wrapper.innerHTML = `<div class="cms-content">Loading...</div>`;

                    try {
                        const pageRes = await window.api(`/api/cms/${slug}`);
                        wrapper.innerHTML = `
                            <div class="cms-content">
                                ${pageRes.page.content || "<em>No content</em>"}
                            </div>
                        `;
                    } catch (err) {
                        wrapper.innerHTML = `<div class="error">Failed to load content</div>`;
                    }
                });
            });

            /* ============================
               INLINE EDIT
            ============================ */
            tableWrap.querySelectorAll(".btn.edit").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const row = btn.closest(".cms-row");
                    const id = row.dataset.id;
                    const slug = row.dataset.slug;
                    const title = row.querySelector(".cms-title").innerText;

                    const detailsRow = document.getElementById(`cms-${slug}`);
                    const wrapper = detailsRow.querySelector(".cms-content-wrapper");

                    detailsRow.classList.remove("hidden");

                    wrapper.innerHTML = `<div class="cms-content">Loading...</div>`;

                    try {
                        const pageRes = await window.api(`/api/cms/${slug}`);
                        const content = pageRes.page.content || "";

                        wrapper.innerHTML = `
                            <div class="cms-edit-form">
                                <label>Title</label>
                                <input type="text" class="cms-input title" value="${title}">

                                <label>Content</label>
                                <textarea class="cms-textarea">${content}</textarea>

                                <div class="cms-edit-actions">
                                    <button class="btn save">Save</button>
                                    <button class="btn cancel">Cancel</button>
                                </div>
                            </div>
                        `;

                        /* SAVE */
                        wrapper.querySelector(".btn.save").addEventListener("click", async () => {
                            const updated = {
                                title: wrapper.querySelector(".title").value,
                                content: wrapper.querySelector(".cms-textarea").value
                            };

                            const res = await window.api(`/api/cms/${id}`, {
                                method: "PUT",
                                body: JSON.stringify(updated)
                            });

                            if (!res.success) {
                                alert(res.error || "Update failed");
                                return;
                            }

                            await tabRenderers[currentTab]();
                        });

                        /* CANCEL → back to VIEW */
                        wrapper.querySelector(".btn.cancel").addEventListener("click", () => {
                            detailsRow.classList.add("hidden");
                        });

                    } catch (err) {
                        wrapper.innerHTML = `<div class="error">Failed to load editor</div>`;
                    }
                });
            });
        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    };
};
