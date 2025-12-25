// 1. Configuration & Global State
const BRANCHES = {
    vandematram: "ChIJT_SeKRiDXjkR9ujjQDt4rMs",
    southbopal: "ChIJT8LlIX-bXjkRkb4LalKy0mE",
    malabar: "ChIJD3x1OdWDXjkRecjalDEqhM0"
};

let currentIndex = 0;

// 2. Main Logic: Load Reviews from Google
async function loadReviews(placeId) {
    try {
        const { Place } = await google.maps.importLibrary("places");
        
        const place = new Place({
            id: placeId,
            requestedLanguage: "en"
        });

        await place.fetchFields({
            fields: ["displayName", "rating", "reviews"]
        });

        const reviewsDiv = document.getElementById("reviews");
        reviewsDiv.innerHTML = ""; // Clear loader/previous reviews
        currentIndex = 0;

        if (!place.reviews || place.reviews.length === 0) {
            reviewsDiv.innerHTML = "<p>No reviews available for this location yet.</p>";
            return;
        }

        place.reviews.slice(0, 8).forEach(r => {
            // Safety check for review text
            const reviewText = r.text ? (typeof r.text === 'object' ? r.text.text : r.text) : "No comment provided.";
            const authorName = r.authorAttribution?.displayName || "A Student";

            reviewsDiv.insertAdjacentHTML(
                "beforeend",
                `
                <div class="review-card">
                    <strong>${authorName}</strong>
                    <div class="stars">⭐ ${r.rating}</div>
                    <p>${reviewText}</p>
                </div>
                `
            );
        });

        updateCarousel();
        injectReviewSchema(place);
    } catch (error) {
        console.error("Reviews failed to load:", error);
        document.getElementById("reviews").innerHTML = "<p>Google Reviews are currently unavailable.</p>";
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