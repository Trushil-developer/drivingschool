document.addEventListener("DOMContentLoaded", async () => {

    // ============================
    // LOAD BRANCHES
    // ============================
    const branchSelect = document.getElementById("branch");

    if (branchSelect) {
        try {
            const res = await fetch("/api/branches");
            const data = await res.json();

            if (!data.success) throw new Error(data.error || "Failed to load branches");

            branchSelect.innerHTML = `<option value="">Select Branch</option>`;

            data.branches.forEach(branch => {
                const option = document.createElement("option");
                option.value = branch.id;
                option.textContent = branch.branch_name;
                branchSelect.appendChild(option);
            });

        } catch (err) {
            console.error("Error loading branches:", err);
            alert("Unable to load branches");
        }
    }

    // ============================
    // LOAD COURSES
    // ============================
    const courseSelect = document.getElementById("course");

    if (courseSelect) {
        try {
            const res = await fetch("/api/courses");
            const data = await res.json();

            if (!data.success) throw new Error(data.error || "Failed to load courses");

            courseSelect.innerHTML = `<option value="">Select Service</option>`;

            data.courses
            .filter(course => course.status === "active")
            .forEach(course => {
                const option = document.createElement("option");
                option.value = course.id;
                option.textContent = course.course_name;
                courseSelect.appendChild(option);
            });


        } catch (err) {
            console.error("Error loading courses:", err);
            alert("Unable to load courses");
        }
    }

    // ============================
    // HANDLE FORM SUBMISSION
    // ============================
    const enquiryForm = document.getElementById("enquiryForm");

    if (enquiryForm) {
        enquiryForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = {
                full_name: document.getElementById("name").value.trim(),
                email: document.getElementById("email").value.trim(),
                phone: document.getElementById("phone").value.trim(),
                branch_id: branchSelect.value || null,
                course_id: courseSelect.value || null,
                has_licence: document.querySelector('input[name="hasLicence"]:checked')?.value || "No",
                message: document.getElementById("message")?.value.trim() || null
            };

            try {
                const res = await fetch("/api/enquiries", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(formData)
                });

                const data = await res.json();

                if (!data.success) throw new Error(data.message || "Failed to submit enquiry");

                alert("Thank you! Your enquiry has been submitted.");
                enquiryForm.reset();
            } catch (err) {
                console.error("Error submitting enquiry:", err);
                alert("Failed to submit enquiry. Please try again later.");
            }
        });
    }
});
