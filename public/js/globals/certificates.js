import { showLoader, hideLoader } from "./loader.js";

// ----------------------------
// GLOBAL: Download Certificate
// ----------------------------
export async function downloadCertificate(bookingId) {
    try {
        showLoader("Preparing download...");

        const res = await fetch(`/api/bookings/${bookingId}/certificate/download`);
        const data = await res.json();

        hideLoader();

        if (data.success && data.url) {
            window.open(data.url, "_blank");
            return true;
        }

        alert(data.error || "Failed to download certificate.");
        return false;

    } catch (err) {
        hideLoader();
        console.error("Certificate download error:", err);
        alert("Error downloading certificate.");
        return false;
    }
}

// ----------------------------
// GLOBAL: Upload / Replace Certificate
// ----------------------------
export function uploadCertificate(bookingId, callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png";

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append("file", file);

        try {
            showLoader("Uploading certificate...");

            // ✅ Match server route
            const result = await fetch(`/api/bookings/${bookingId}/certificate`, {
                method: "POST",
                body: fd
            }).then(r => r.json());

            hideLoader();

            if (result.success) {
                alert("Certificate uploaded successfully");
                if (callback) callback();   // Refresh UI
            } else {
                alert(result.error || "Upload failed");
            }
        } catch (err) {
            hideLoader();
            console.error("Upload failed:", err);
            alert("Server error while uploading certificate.");
        }
    };

    input.click();
}
