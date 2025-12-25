// 1. Configuration & Global State
const BRANCHES = {
    vandematram: "ChIJT_SeKRiDXjkR9ujjQDt4rMs",
    southbopal: "ChIJT8LlIX-bXjkRkb4LalKy0mE",
    malabar: "ChIJD3x1OdWDXjkRecjalDEqhM0"
};

let currentIndex = 0;

// 2. Main Logic: Load Reviews from Google
async function loadReviews(placeId) {
    console.log("🔍 Fetching reviews for Place ID:", placeId);
    const reviewsDiv = document.getElementById("reviews");
    
    // 1. Show a loader while waiting
    reviewsDiv.innerHTML = `<div class="loader">Loading Google Reviews...</div>`;

    try {
        const { Place } = await google.maps.importLibrary("places");
        console.log("✅ Places Library Loaded");

        const place = new Place({
            id: placeId,
            requestedLanguage: "en"
        });

        console.log("⏳ Fetching Fields from Google...");
        await place.fetchFields({
            fields: ["displayName", "rating", "reviews", "formattedAddress"]
        });

        console.log("📦 Full Data Received:", place);

        reviewsDiv.innerHTML = ""; // Clear loader
        currentIndex = 0;

        if (!place.reviews || place.reviews.length === 0) {
            console.warn("⚠️ No reviews found for this Place ID.");
            reviewsDiv.innerHTML = "<p>No reviews available for this location yet.</p>";
            return;
        }

        console.log(`⭐ Found ${place.reviews.length} reviews.`);

        place.reviews.slice(0, 8).forEach((r, index) => {
            // Log individual review structure to see if text/name is missing
            console.log(`Review #${index}:`, r);

            const reviewText = r.text ? (typeof r.text === 'object' ? r.text.text : r.text) : "No comment provided.";
            const authorName = r.authorAttribution?.displayName || "A Student";
            const rating = r.rating || 5;

            reviewsDiv.insertAdjacentHTML(
                "beforeend",
                `
                <div class="review-card">
                    <strong>${authorName}</strong>
                    <div class="stars">⭐ ${rating}</div>
                    <p>${reviewText}</p>
                </div>
                `
            );
        });

        updateCarousel();
        injectReviewSchema(place);
        console.log("✨ Carousel Updated and Rendered");

    } catch (error) {
        console.error("❌ CRITICAL ERROR:", error);
        reviewsDiv.innerHTML = `<p>Error loading reviews. Check console for details.</p>`;
    }
}
// 3. UI Logic: Carousel movement
function updateCarousel() {
    const track = document.querySelector(".reviews-track");
    const cards = document.querySelectorAll(".review-card");
    if(!track || cards.length === 0) return;

    const maxIndex = Math.max(0, cards.length - 3); 
    currentIndex = Math.min(currentIndex, maxIndex);

    track.style.transform = `translateX(-${currentIndex * 320}px)`;
}

// 4. SEO: Inject JSON-LD Schema
function injectReviewSchema(place) {
    document.getElementById("review-schema")?.remove();

    const schema = {
        "@context": "https://schema.org",
        "@type": "DrivingSchool",
        "name": place.displayName,
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": place.rating,
            "reviewCount": place.reviews?.length || 0
        },
        "review": place.reviews?.slice(0, 5).map(r => ({
            "@type": "Review",
            "author": { "@type": "Person", "name": r.authorAttribution?.displayName || "Anonymous" },
            "reviewRating": { "@type": "Rating", "ratingValue": r.rating },
            "reviewBody": r.text?.text || r.text || ""
        }))
    };

    const script = document.createElement("script");
    script.id = "review-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
}

// 5. Navigation: Booking function
function bookNow(trainingDays) {
    if (!trainingDays) return;

    if (typeof gtag === "function") {
        gtag("event", "book_now_click", {
            event_category: "engagement",
            event_label: `${trainingDays}_days_course`
        });
    }

    const params = new URLSearchParams({ training_days: trainingDays });
    window.location.href = `register.html?${params.toString()}`;
}

// 6. Entry Point: Called by Google Maps Script
async function initMaps() {
    // Nav Buttons
    const nextBtn = document.querySelector(".nav.next");
    const prevBtn = document.querySelector(".nav.prev");
    
    if(nextBtn) nextBtn.onclick = () => { currentIndex++; updateCarousel(); };
    if(prevBtn) prevBtn.onclick = () => { currentIndex = Math.max(0, currentIndex - 1); updateCarousel(); };

    // Branch Switcher
    const branchSelect = document.getElementById("branchSelect");
    if (branchSelect) {
        branchSelect.onchange = e => loadReviews(BRANCHES[e.target.value]);
    }

    // Initial Load
    loadReviews(BRANCHES.vandematram);
}

window.initMaps = initMaps;