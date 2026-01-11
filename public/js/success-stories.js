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
            let currentPage = 1;
            const totalPages = Math.ceil(images.length / perPage);

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

                const pagination = document.createElement("div");
                pagination.id = "certPagination";
                pagination.style.textAlign = "center";
                pagination.style.marginTop = "25px";
                pagination.style.display = "flex";
                pagination.style.justifyContent = "center";
                pagination.style.gap = "10px";

                for (let i = 1; i <= totalPages; i++) {
                    const btn = document.createElement("button");
                    btn.textContent = i;
                    btn.style.padding = "6px 12px";
                    btn.style.border = "1px solid #1565c0";
                    btn.style.borderRadius = "4px";
                    btn.style.backgroundColor = i === currentPage ? "#1565c0" : "#fff";
                    btn.style.color = i === currentPage ? "#fff" : "#1565c0";
                    btn.style.cursor = "pointer";

                    btn.addEventListener("click", () => {
                        currentPage = i;
                        renderPage(currentPage);
                        window.scrollTo({ top: gallery.offsetTop - 50, behavior: 'smooth' });
                    });

                    pagination.appendChild(btn);
                }

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
