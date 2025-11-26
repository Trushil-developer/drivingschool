document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("branchCheckboxGroup");
    if (!container) return;

    try {
        const res = await fetch("/api/branches");
        const data = await res.json();

        if (!data.success) throw new Error(data.error || "Failed to load branches");

        container.innerHTML = ""; // clear default

        data.branches.forEach(branch => {
            const label = document.createElement("label");
            label.innerHTML = `<input type="checkbox" name="branch" value="${branch.branch_name}"> ${branch.branch_name}`;
            container.appendChild(label);
        });

        // Only one selection
        container.querySelectorAll("input[type='checkbox']").forEach(cb => {
            cb.addEventListener("change", () => {
                if (cb.checked) {
                    container.querySelectorAll("input[type='checkbox']").forEach(other => {
                        if (other !== cb) other.checked = false;
                    });
                }
            });
        });

    } catch (err) {
        console.error("Error loading branches:", err);
        alert("Unable to load branches");
    }
});
