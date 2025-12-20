document.addEventListener("DOMContentLoaded", loadTrainingDays);

async function loadTrainingDays() {
    const container = document.getElementById("trainingDaysGroup");
    if (!container) return;

    try {
        const res = await fetch("/api/training-days");
        const data = await res.json();

        if (!data.success || !Array.isArray(data.training_days)) {
            container.innerHTML = "<p style='color:red;'>Failed to load training days</p>";
            return;
        }

        container.innerHTML = data.training_days
            .filter(day => day.is_active === 1)
            .map(day => `
                <button
                    class="training-day-btn"
                    data-days="${day.days}">
                    ${day.days} Days
                </button>
            `)
            .join("");

        attachClickEvents();
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p style='color:red;'>Error loading training days</p>";
    }
}

function attachClickEvents() {
    document.querySelectorAll(".training-day-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const days = btn.dataset.days;
            window.location.href =
                `register.html?training_days=${encodeURIComponent(days)}`;
        });
    });
}
