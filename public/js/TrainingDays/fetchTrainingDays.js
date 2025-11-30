document.addEventListener("DOMContentLoaded", loadTrainingDays);

async function loadTrainingDays() {
    const container = document.getElementById("trainingDaysGroup");
    if (!container) return;

    container.innerHTML = "Loading...";

    try {
        const res = await fetch("/api/training-days");
        const data = await res.json();

        if (!data.success || !Array.isArray(data.training_days)) {
            container.innerHTML = "<p style='color:red;'>Failed to load options</p>";
            return;
        }

        container.innerHTML = data.training_days
            .filter(day => day.is_active === 1)
            .map(day => `
                <label>
                    <input type="radio" name="training_days" value="${day.days}">
                    ${day.days} Days
                </label>
            `)
            .join("");
    } catch (err) {
        container.innerHTML = "<p style='color:red;'>Error loading training days</p>";
    }
}
