// Page numbers to show: always first and last, the current page with one
// neighbour each side, and "…" for the gaps — e.g. 1 … 4 5 6 … 59.
function pageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current - 1, current, current + 1]);
    if (current <= 3) [2, 3, 4].forEach(p => pages.add(p));
    if (current >= total - 2) [total - 3, total - 2, total - 1].forEach(p => pages.add(p));
    const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : "…");
        out.push(p);
    });
    return out;
}

document.addEventListener("DOMContentLoaded", () => {

    // ====================
    // Load header & footer
    // ====================
    document.querySelectorAll('[data-include]').forEach(el => {
        fetch(el.getAttribute('data-include'))
            .then(res => res.text())
            .then(html => el.innerHTML = html)
            .catch(err => console.error("Include load error:", err));
    });

    // ====================
    // Fetch certificates
    // ====================
    fetch("/api/public/certificates")
        .then(res => res.json())
        .then(data => {
            const gallery = document.getElementById("certificateGallery");
            gallery.innerHTML = "";

            if (!data.success || data.images.length === 0) {
                gallery.innerHTML = "<p>No certificates uploaded yet.</p>";
                return;
            }

            const images = data.images;
            const perPage = 9;
            const totalPages = Math.ceil(images.length / perPage);

            // The page lives in the URL (?page=N) so refresh, shared links and
            // the browser Back button land on the same page.
            function pageFromUrl() {
                const n = parseInt(new URLSearchParams(location.search).get("page"), 10);
                return Number.isInteger(n) ? Math.min(Math.max(n, 1), totalPages) : 1;
            }
            let currentPage = pageFromUrl();

            function goToPage(page) {
                currentPage = page;
                const url = new URL(location.href);
                if (page === 1) url.searchParams.delete("page");
                else url.searchParams.set("page", page);
                history.pushState({ page }, "", url);
                renderPage(currentPage);
                window.scrollTo({ top: gallery.offsetTop - 50, behavior: 'smooth' });
            }

            window.addEventListener("popstate", () => {
                currentPage = pageFromUrl();
                renderPage(currentPage);
            });

            // --------------------
            // Render page
            // --------------------
            function renderPage(page) {
                gallery.innerHTML = "";
                const start = (page - 1) * perPage;
                const end = start + perPage;
                const pageImages = images.slice(start, end);

                pageImages.forEach(img => {
                    const card = document.createElement("div");
                    card.className = "branch-card";

                    // SEO-friendly: descriptive alt
                    const altText = img.studentName
                        ? `Certificate of ${img.studentName} for training on ${img.course || "vehicle"} from Dwarkesh Motor Driving School Ahmedabad`
                        : `Driving course certificate from Dwarkesh Motor Driving School Ahmedabad`;

                    card.innerHTML = `
                        <img 
                            src="${img.url}" 
                            alt="${altText}" 
                            loading="lazy"
                        />
                      
                        ${img.course ? `<p><strong>Car Trained On:</strong> ${img.course}</p>` : ""}
                        ${img.date ? `<p><strong>Completion Date:</strong> ${img.date}</p>` : ""}
                    `;
                    gallery.appendChild(card);
                });

                // --------------------
                // Add JSON-LD structured data for current page
                // --------------------
                updateStructuredData(pageImages);

                renderPagination();
            }

            // --------------------
            // Pagination controls
            // --------------------
            function renderPagination() {
                const oldPagination = document.getElementById("certPagination");
                if (oldPagination) oldPagination.remove();

                if (totalPages <= 1) return;

                const pagination = document.createElement("nav");
                pagination.id = "certPagination";
                pagination.setAttribute("aria-label", "Certificate pages");
                pagination.style.marginTop = "25px";
                pagination.style.display = "flex";
                pagination.style.flexWrap = "wrap";
                pagination.style.justifyContent = "center";
                pagination.style.alignItems = "center";
                pagination.style.gap = "8px";

                function addButton(label, page, { active = false, disabled = false, ariaLabel } = {}) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.textContent = label;
                    if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
                    if (active) btn.setAttribute("aria-current", "page");
                    btn.disabled = disabled;
                    btn.style.minWidth = "40px";
                    btn.style.padding = "6px 12px";
                    btn.style.border = "1px solid #1565c0";
                    btn.style.borderRadius = "4px";
                    btn.style.backgroundColor = active ? "#1565c0" : "#fff";
                    btn.style.color = active ? "#fff" : "#1565c0";
                    btn.style.cursor = disabled || active ? "default" : "pointer";
                    btn.style.opacity = disabled ? "0.4" : "1";
                    if (!disabled && !active) btn.addEventListener("click", () => goToPage(page));
                    pagination.appendChild(btn);
                }

                addButton("‹ Prev", currentPage - 1, { disabled: currentPage === 1, ariaLabel: "Previous page" });
                pageNumbers(currentPage, totalPages).forEach(p => {
                    if (p === "…") {
                        const gap = document.createElement("span");
                        gap.textContent = "…";
                        gap.style.color = "#1565c0";
                        pagination.appendChild(gap);
                    } else {
                        addButton(String(p), p, { active: p === currentPage, ariaLabel: `Page ${p}` });
                    }
                });
                addButton("Next ›", currentPage + 1, { disabled: currentPage === totalPages, ariaLabel: "Next page" });

                const info = document.createElement("div");
                info.style.flexBasis = "100%";
                info.style.textAlign = "center";
                info.style.color = "#555";
                info.style.fontSize = "14px";
                const from = (currentPage - 1) * perPage + 1;
                const to = Math.min(currentPage * perPage, images.length);
                info.textContent = `Showing ${from}–${to} of ${images.length} certificates`;
                pagination.appendChild(info);

                gallery.parentNode.appendChild(pagination);
            }

            // --------------------
            // Inject JSON-LD for certificates (for SEO)
            // --------------------
            function updateStructuredData(images) {
                const oldScript = document.getElementById("certificates-ld");
                if (oldScript) oldScript.remove();

                const ld = {
                    "@context": "https://schema.org",
                    "@type": "EducationalOccupationalProgram",
                    "name": "Driving Courses Certificates",
                    "provider": {
                        "@type": "DrivingSchool",
                        "name": "Dwarkesh Motor Driving School",
                        "url": "https://dwarkeshdrivingschool.com"
                    },
                    "hasCourseInstance": images.map(img => ({
                        "@type": "Course",
                        "name": `Driving Training on ${img.course || "Vehicle"}`,
                        "courseMode": "Offline",
                        "provider": {
                            "@type": "Organization",
                            "name": "Dwarkesh Motor Driving School",
                            "sameAs": "https://dwarkeshdrivingschool.com"
                        },
                        "educationalCredentialAwarded": `Certificate for ${img.studentName || "student"} - ${img.course || "Vehicle"} Training`
                    }))
                };

                const script = document.createElement("script");
                script.type = "application/ld+json";
                script.id = "certificates-ld";
                script.textContent = JSON.stringify(ld, null, 2);
                document.head.appendChild(script);
            }

            // Render first page
            renderPage(currentPage);

        })
        .catch(err => {
            console.error("Failed to load certificates:", err);
            document.getElementById("certificateGallery").innerHTML =
                "<p>Unable to load certificates at the moment.</p>";
        });
});
