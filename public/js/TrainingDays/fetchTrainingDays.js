document.addEventListener("DOMContentLoaded", loadTrainingDays);

async function loadTrainingDays() {
    const container = document.getElementById("trainingDaysGroup");
    if (!container) return;

    try {
        const res = await fetch("/api/training-days");
        const data = await res.json();

        if (!data.success || !Array.isArray(data.training_days)) {
            container.innerHTML = "<p style='color:red;'>Failed to load options</p>";
            return;
        }

        window.trainingDaysList = data.training_days; 
        
        container.innerHTML = data.training_days
            .filter(day => day.is_active === 1)
            .map(day => `
                <label>
                    <input type="radio" 
                           name="training_slots" 
                           value="${day.days}" 
                           data-label="${day.days} Days"> 
                    ${day.days} Days
                </label>
            `)
            .join("");
    } catch (err) {
        container.innerHTML = "<p style='color:red;'>Error loading training days</p>";
    }
}
