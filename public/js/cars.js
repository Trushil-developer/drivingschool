// cars-dropdown.js
document.addEventListener("DOMContentLoaded", async () => {
    const branchContainer = document.getElementById("branchCheckboxGroup");
    const carSelect = document.getElementById("carSelect");

    if (!branchContainer || !carSelect) return;

    // Load branches
    async function loadBranches() {
        try {
            const res = await fetch("/api/branches");
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Failed to fetch branches");

            data.branches.forEach(branch => {
                const label = document.createElement("label");
                label.innerHTML = `<input type="checkbox" name="branch" value="${branch.branch_name}"> ${branch.branch_name}`;
                branchContainer.appendChild(label);
            });

            branchContainer.addEventListener("change", onBranchChange);
        } catch (err) {
            console.error(err);
            branchContainer.innerHTML = `<p style="color:red;">Failed to load branches</p>`;
        }
    }

    // Load cars when branch selected
    async function onBranchChange() {
        const checked = [...branchContainer.querySelectorAll("input[name='branch']:checked")][0];

        // Allow only one branch
        branchContainer.querySelectorAll("input[name='branch']").forEach(b => {
            if (b !== checked) b.checked = false;
        });

        const selectedBranch = checked?.value || "";

        if (!selectedBranch) {
            carSelect.innerHTML = `<option value="">Select Branch First</option>`;
            return;
        }

        try {
            const res = await fetch("/api/cars");
            const data = await res.json();
            if (!data.success) throw new Error("Failed to fetch cars");

            const cars = data.cars.filter(c => c.branch === selectedBranch);

            // Populate dropdown
            carSelect.innerHTML = `<option value="">Select Car</option>`;
            cars.forEach(car => {
                const opt = document.createElement("option");
                opt.value = car.car_name;
                opt.textContent = car.car_name;
                carSelect.appendChild(opt);
            });

        } catch (err) {
            console.error(err);
            carSelect.innerHTML = `<option value="">Failed to load Cars</option>`;
        }
    }

    // If user touches car dropdown before selecting branch → alert
    carSelect.addEventListener("click", () => {
        const anyBranchSelected = branchContainer.querySelector("input[name='branch']:checked");

        if (!anyBranchSelected) {
            alert("Please select a Branch first.");
        }
    });

    await loadBranches();
});
