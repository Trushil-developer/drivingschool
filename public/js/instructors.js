document.addEventListener("DOMContentLoaded", () => {
    const branchContainer = document.getElementById("branchCheckboxGroup");
    const instructorSelect = document.getElementById("instructorSelect");

    if (!branchContainer || !instructorSelect) return;

    instructorSelect.disabled = true;
    instructorSelect.innerHTML = `<option value="">Select Branch First</option>`;

    async function loadInstructors(selectedBranch) {
        try {
            const res = await fetch("/api/instructors");
            const data = await res.json();
            if (!data.success) throw new Error("Failed to fetch instructors");

            const instructors = data.instructors.filter(
                ins => ins.is_active && ins.branch === selectedBranch
            );

            instructorSelect.innerHTML = "";

            if (!instructors.length) {
                const option = document.createElement("option");
                option.value = "";
                option.textContent = "No instructors available";
                instructorSelect.appendChild(option);
                instructorSelect.disabled = true;
                return;
            }

            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select Instructor";
            instructorSelect.appendChild(defaultOption);

            instructors.forEach(ins => {
                const option = document.createElement("option");
                option.value = ins.instructor_name;
                option.textContent = ins.instructor_name;
                instructorSelect.appendChild(option);
            });

            instructorSelect.disabled = false; 
        } catch (err) {
            console.error(err);
            instructorSelect.innerHTML = `<option value="">Failed to load instructors</option>`;
            instructorSelect.disabled = true;
        }
    }

    branchContainer.addEventListener("change", () => {
        const checked = branchContainer.querySelector("input[name='branch']:checked");

        // Only allow one branch
        branchContainer.querySelectorAll("input[name='branch']").forEach(b => {
            if (b !== checked) b.checked = false;
        });

        if (!checked) {
            instructorSelect.innerHTML = `<option value="">Select Branch First</option>`;
            instructorSelect.disabled = true;
            return;
        }

        loadInstructors(checked.value);
    });
});
