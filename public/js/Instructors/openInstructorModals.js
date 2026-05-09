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
            <h2>Add Employee</h2>
            <div class="modal-content-form">
                <label>Name</label><input id="ins_name" type="text" required>
                <label>Role</label>
                <select id="ins_role" required>
                    <option value="Instructor">Instructor</option>
                    <option value="Office Staff">Office Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Other">Other</option>
                </select>
                <label>Email</label><input id="ins_email" type="email">
                <label>Mobile</label><input id="ins_mobile" type="text" required>
                <label>Branch</label>
                <select id="ins_branch" required>${branchOptions}</select>
                <label>Driver Licence</label><input id="ins_license" type="text">
                <label>Adhar No</label><input id="ins_adhar" type="text">
                <label>Address</label><textarea id="ins_address"></textarea>
                <button id="saveInstructor" class="btn primary">Save Employee</button>
            </div>
        `;
        window.Modal.setContent(formHTML);
        window.Modal.show();

        setTimeout(() => {
            document.getElementById("saveInstructor").onclick = async () => {
                const instructorData = {
                    instructor_name: document.getElementById("ins_name").value.trim(),
                    role: document.getElementById("ins_role").value,
                    email: document.getElementById("ins_email").value.trim(),
                    mobile_no: document.getElementById("ins_mobile").value.trim(),
                    branch: document.getElementById("ins_branch").value.trim(),
                    drivers_license: document.getElementById("ins_license").value.trim(),
                    adhar_no: document.getElementById("ins_adhar").value.trim(),
                    address: document.getElementById("ins_address").value.trim(),
                };

                if (!instructorData.instructor_name) return alert("Please fill in name");
                if (!instructorData.mobile_no) return alert("Please fill in mobile");
                if (!instructorData.branch) return alert("Please select a branch");

                try {
                    const res = await window.api("/api/instructors", {
                        method: "POST",
                        body: JSON.stringify(instructorData),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!res.success) throw new Error(res.error || "Failed to save employee");
                    alert("Employee saved successfully!");
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

        const roles = ['Instructor', 'Office Staff', 'Manager', 'Other'];
        const formHTML = `
            <h2>Edit Employee</h2>
            <div class="modal-content-form">
                <label>Name</label><input id="ins_name" type="text" value="${data.instructor_name || ''}" required>
                <label>Role</label>
                <select id="ins_role" required>
                    ${roles.map(r => `<option value="${r}" ${(data.role || 'Instructor') === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <label>Email</label><input id="ins_email" type="email" value="${data.email || ''}">
                <label>Mobile</label><input id="ins_mobile" type="text" value="${data.mobile_no || ''}" required>
                <label>Branch</label>
                <select id="ins_branch" required>${branchOptions}</select>
                <label>Driver Licence</label><input id="ins_license" type="text" value="${data.drivers_license || ''}">
                <label>Adhar No</label><input id="ins_adhar" type="text" value="${data.adhar_no || ''}">
                <label>Address</label><textarea id="ins_address">${data.address || ''}</textarea>
                <button id="saveInstructor" class="btn primary">Save Changes</button>
            </div>
        `;
        window.Modal.setContent(formHTML);
        window.Modal.show();

        setTimeout(() => {
            document.getElementById("saveInstructor").onclick = async () => {
                const instructorData = {
                    instructor_name: document.getElementById("ins_name").value.trim(),
                    role: document.getElementById("ins_role").value,
                    email: document.getElementById("ins_email").value.trim(),
                    mobile_no: document.getElementById("ins_mobile").value.trim(),
                    branch: document.getElementById("ins_branch").value.trim(),
                    drivers_license: document.getElementById("ins_license").value.trim(),
                    adhar_no: document.getElementById("ins_adhar").value.trim(),
                    address: document.getElementById("ins_address").value.trim(),
                };

                if (!instructorData.instructor_name) return alert("Please fill in name");
                if (!instructorData.mobile_no) return alert("Please fill in mobile");
                if (!instructorData.branch) return alert("Please select a branch");

                try {
                    const res = await window.api(`/api/instructors/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(instructorData),
                        headers: { "Content-Type": "application/json" }
                    });
                    if(!res.success) throw new Error(res.error || "Failed to update employee");
                    alert("Employee updated successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            };
        }, 50);
    }
};
