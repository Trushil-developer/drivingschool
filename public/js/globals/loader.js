// Show loader (requires loadingOverlay div)
export function showLoader(message = "Loading...") {
    const loader = document.getElementById("loadingOverlay");
    if (!loader) return;
    loader.textContent = message;
    loader.style.display = "block";
}

// Hide loader
export function hideLoader() {
    const loader = document.getElementById("loadingOverlay");
    if (!loader) return;
    loader.style.display = "none";
}