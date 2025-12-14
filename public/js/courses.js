document.addEventListener("DOMContentLoaded", async () => {
    const courseSelect = document.getElementById("courseSelect");
    if (!courseSelect) return;

    try {
        const res = await fetch("/api/courses");
        const data = await res.json();

        if (!data.success) throw new Error("Failed to load courses");

        courseSelect.innerHTML = `<option value="">Select Service</option>`;

        data.courses
            .filter(c => c.status === "active")
            .forEach(course => {
                const opt = document.createElement("option");
                opt.value = course.id;
                opt.textContent = course.course_name;
                courseSelect.appendChild(opt);
            });

    } catch (err) {
        console.error("Course load error:", err);
    }
});
