// ========================
// ADD COURSE MODAL
// ========================
window.openCourseAddModal = function (tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Add Course</h2>
                <div class="modal-content-form course-modal">

                    <label>Course Name</label>
                    <input id="course_name" type="text">

                    <label>Description</label>
                    <textarea id="description"></textarea>

                    <label>Status</label>
                    <select id="status">
                        <option value="active" selected>Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    <button id="saveCourse" class="btn primary">Save Course</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            // Save handler
            document.getElementById("saveCourse").onclick = async () => {
                const payload = {
                    course_name: document.getElementById("course_name").value.trim(),
                    description: document.getElementById("description").value.trim(),
                    status: document.getElementById("status").value
                };

                if (!payload.course_name) return alert("Course name is required");

                try {
                    const res = await window.api("/api/courses", {
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to add course");

                    alert("Course added successfully!");
                    window.Modal.hide();
                    tabRenderers[currentTab]?.();

                } catch (err) {
                    alert("Error: " + err.message);
                }
            };

        } catch (err) {
            console.error(err);
            alert("Error opening modal: " + err.message);
        }
    };
};

// ========================
// EDIT COURSE MODAL
// ========================
window.openCourseEditModal = function (id, data, tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Edit Course</h2>
                <div class="modal-content-form course-modal">

                    <label>Course Name</label>
                    <input id="course_name" type="text" value="${data.course_name || ''}">

                    <label>Description</label>
                    <textarea id="description">${data.description || ''}</textarea>

                    <label>Status</label>
                    <select id="status">
                        <option value="active" ${data.status === "active" ? "selected" : ""}>Active</option>
                        <option value="inactive" ${data.status === "inactive" ? "selected" : ""}>Inactive</option>
                    </select>

                    <button id="saveCourse" class="btn primary">Save Changes</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            // Save handler
            document.getElementById("saveCourse").onclick = async () => {
                const payload = {
                    course_name: document.getElementById("course_name").value.trim(),
                    description: document.getElementById("description").value.trim(),
                    status: document.getElementById("status").value
                };

                if (!payload.course_name) return alert("Course name is required");

                try {
                    const res = await window.api(`/api/courses/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to update course");

                    alert("Course updated successfully!");
                    window.Modal.hide();
                    tabRenderers[currentTab]?.();

                } catch (err) {
                    alert("Error: " + err.message);
                }
            };

        } catch (err) {
            console.error(err);
            alert("Error opening modal: " + err.message);
        }
    };
};
