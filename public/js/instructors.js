document.addEventListener("DOMContentLoaded", async () => {
    const select = document.getElementById("instructorSelect");
    if (!select) return;

    try {
        const res = await fetch("/api/instructors");
        const data = await res.json();

        if (!data.success) throw new Error(data.error || "Failed to load instructors");

        data.instructors.forEach(ins => {
            const option = document.createElement("option");
            option.value = ins.instructor_name;
            option.textContent = ins.instructor_name;
            select.appendChild(option);
        });

    } catch (err) {
        console.error("Error loading instructors:", err);
        alert("Unable to load instructors");
    }
});
