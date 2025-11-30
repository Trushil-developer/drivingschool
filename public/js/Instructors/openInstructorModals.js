// -------------------- Add Instructor Modal --------------------
window.openInstructorAddModal = function(tabRenderers, currentTab) {
    return async function() {
        if (!window.Modal) return;
        if (!window.Modal.el) window.Modal.init();

        // Fetch branches from API
        let branchOptions = "<option value=''>Loading...</option>";
        try {
            const res = await window.api("/api/branches");
            if(res.success && res.branches.length) {
                branchOptions = res.branches.map(b => 
                    `<option value="${b.branch_name}">${b.branch_name}</option>`
                ).join('');
            } else {
                branchOptions = "<option value=''>No branches found</option>";
            }
        } catch(err) {
            branchOptions = "<option value=''>Error loading branches</option>";
            console.error(err);
        }

        const formHTML = `
            <h2>Add Instructor</h2>
            <div class="modal-content-form">
                <label>Name</label><input id="ins_name" type="text" required>
                <label>Email</label><input id="ins_email" type="email" required>
                <label>Mobile</label><input id="ins_mobile" type="text" required>
                <label>Branch</label>
                <select id="ins_branch" required>${branchOptions}</select>
                <label>Driver Licence</label><input id="ins_license" type="text" required>
                <label>Adhar No</label><input id="ins_adhar" type="text" required>
                <label>Address</label><textarea id="ins_address" required></textarea>
                <button id="saveInstructor" class="btn primary">Save Instructor</button>
            </div>
        `;
        window.Modal.setContent(formHTML);
        window.Modal.show();

        setTimeout(() => {
            document.getElementById("saveInstructor").onclick = async () => {
                const instructorData = {
                    instructor_name: document.getElementById("ins_name").value.trim(),
                    email: document.getElementById("ins_email").value.trim(),
                    mobile_no: document.getElementById("ins_mobile").value.trim(),
                    branch: document.getElementById("ins_branch").value.trim(),
                    drivers_license: document.getElementById("ins_license").value.trim(),
                    adhar_no: document.getElementById("ins_adhar").value.trim(),
                    address: document.getElementById("ins_address").value.trim(),
                };

                for (const [key, value] of Object.entries(instructorData)) {
                    if (!value) return alert(`Please fill in ${key.replace('_', ' ')}`);
                }

                try {
                    const res = await window.api("/api/instructors", {
                        method: "POST",
                        body: JSON.stringify(instructorData),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!res.success) throw new Error(res.error || "Failed to save instructor");
                    alert("Instructor saved successfully!");
                    window.Modal.hide();
                    if (tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            };
        }, 50);
    }
};

// -------------------- Edit Instructor Modal --------------------
window.openInstructorEditModal = function(id, data, tabRenderers, currentTab) {
    return async function() {
        if (!window.Modal) return;
        if (!window.Modal.el) window.Modal.init();

        // Fetch branches from API
        let branchOptions = "<option value=''>Loading...</option>";
        try {
            const res = await window.api("/api/branches");
            if(res.success && res.branches.length) {
                branchOptions = res.branches.map(b => 
                    `<option value="${b.branch_name}" ${b.branch_name === data.branch ? 'selected' : ''}>${b.branch_name}</option>`
                ).join('');
            } else {
                branchOptions = "<option value=''>No branches found</option>";
            }
        } catch(err) {
            branchOptions = "<option value=''>Error loading branches</option>";
            console.error(err);
        }

        const formHTML = `
            <h2>Edit Instructor</h2>
            <div class="modal-content-form">
                <label>Name</label><input id="ins_name" type="text" value="${data.instructor_name || ''}" required>
                <label>Email</label><input id="ins_email" type="email" value="${data.email || ''}" required>
                <label>Mobile</label><input id="ins_mobile" type="text" value="${data.mobile_no || ''}" required>
                <label>Branch</label>
                <select id="ins_branch" required>${branchOptions}</select>
                <label>Driver Licence</label><input id="ins_license" type="text" value="${data.drivers_license || ''}" required>
                <label>Adhar No</label><input id="ins_adhar" type="text" value="${data.adhar_no || ''}" required>
                <label>Address</label><textarea id="ins_address" required>${data.address || ''}</textarea>
                <button id="saveInstructor" class="btn primary">Save Changes</button>
            </div>
        `;
        window.Modal.setContent(formHTML);
        window.Modal.show();

        setTimeout(() => {
            document.getElementById("saveInstructor").onclick = async () => {
                const instructorData = {
                    instructor_name: document.getElementById("ins_name").value.trim(),
                    email: document.getElementById("ins_email").value.trim(),
                    mobile_no: document.getElementById("ins_mobile").value.trim(),
                    branch: document.getElementById("ins_branch").value.trim(),
                    drivers_license: document.getElementById("ins_license").value.trim(),
                    adhar_no: document.getElementById("ins_adhar").value.trim(),
                    address: document.getElementById("ins_address").value.trim(),
                };

                for (const [key, value] of Object.entries(instructorData)) {
                    if (!value) return alert(`Please fill in ${key.replace('_', ' ')}`);
                }

                try {
                    const res = await window.api(`/api/instructors/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(instructorData),
                        headers: { "Content-Type": "application/json" }
                    });
                    if(!res.success) throw new Error(res.error || "Failed to update instructor");
                    alert("Instructor updated successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            };
        }, 50);
    }
};
