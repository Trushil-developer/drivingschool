document.addEventListener("DOMContentLoaded", () => {
    const branchContainer = document.getElementById("branchCheckboxGroup");
    const carSelect = document.getElementById("carSelect");

    if (!branchContainer || !carSelect) return;

    async function loadCars(selectedBranch) {
        try {
            const res = await fetch("/api/cars");
            const data = await res.json();
            if (!data.success) throw new Error("Failed to fetch cars");

            const cars = data.cars.filter(c => c.branch === selectedBranch);

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

    branchContainer.addEventListener("change", () => {
        const checked = branchContainer.querySelector("input[name='branch']:checked");
        // Only allow one branch
        branchContainer.querySelectorAll("input[name='branch']").forEach(b => {
            if (b !== checked) b.checked = false;
        });

        if (!checked) {
            carSelect.innerHTML = `<option value="">Select Branch First</option>`;
            return;
        }

        loadCars(checked.value);
    });

    // Prevent user from touching car dropdown before selecting branch
    carSelect.addEventListener("click", () => {
        const anyBranchSelected = branchContainer.querySelector("input[name='branch']:checked");
        if (!anyBranchSelected) alert("Please select a Branch first.");
    });
});
