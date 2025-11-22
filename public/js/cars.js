document.addEventListener("DOMContentLoaded", async () => {
    const carsContainer = document.getElementById("carsCheckboxGroup");
    if (!carsContainer) return;

    try {
        const res = await fetch("/api/cars");
        const data = await res.json();

        if (!data.success) throw new Error(data.error || "Failed to fetch cars");

        // Clear container
        carsContainer.innerHTML = "";

        data.cars.forEach(car => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "car";
            checkbox.value = car.car_name;

            // Enforce only one selection
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    const allCheckboxes = carsContainer.querySelectorAll('input[type="checkbox"]');
                    allCheckboxes.forEach(cb => {
                        if (cb !== checkbox) cb.checked = false;
                    });
                }
            });

            label.appendChild(checkbox);
            label.append(` ${car.car_name}`);
            carsContainer.appendChild(label);
        });

    } catch (err) {
        console.error("Error fetching cars:", err);
        carsContainer.innerHTML = `<p style="color:red;">Failed to load cars</p>`;
    }
});
