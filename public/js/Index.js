function bookNow(trainingDays) {
    if (!trainingDays) return;

    if (typeof gtag === "function") {
        gtag("event", "book_now_click", {
            event_category: "engagement",
            event_label: `${trainingDays}_days_course`
        });
    }

    const params = new URLSearchParams({
        training_days: trainingDays
    });

    window.location.href = `register.html?${params.toString()}`;
}

const BRANCHES = {
    vandematram: "ChIJT_SeKRiDXjkR9ujjQDt4rMs",
    southbopal: "ChIJT8LlIX-bXjkRkb4LalKy0mE",
    malabar: "ChIJD3x1OdWDXjkRecjalDEqhM0"
};

let currentIndex = 0;

async function loadReviews(placeId) {
    const place = new google.maps.places.Place({
        id: placeId,
        requestedLanguage: "en"
    });

    await place.fetchFields({
        fields: ["displayName", "rating", "reviews"]
    });

    const reviewsDiv = document.getElementById("reviews");
    reviewsDiv.innerHTML = "";
    currentIndex = 0;

    if (!place.reviews?.length) return;

    place.reviews.slice(0, 8).forEach(r => {
        reviewsDiv.insertAdjacentHTML(
            "beforeend",
            `
            <div class="review-card">
                <strong>${r.authorAttribution.displayName}</strong>
                <div class="stars">⭐ ${r.rating}</div>
                <p>${r.text.text}</p>
            </div>
            `
        );
    });

    updateCarousel();
    injectReviewSchema(place);
}

function updateCarousel() {
    const track = document.querySelector(".reviews-track");
    const cards = document.querySelectorAll(".review-card");

    const maxIndex = Math.max(0, cards.length - 3); 
    currentIndex = Math.min(currentIndex, maxIndex);

    track.style.transform = `translateX(-${currentIndex * 320}px)`;
}

function injectReviewSchema(place) {
    document.getElementById("review-schema")?.remove();

    const schema = {
        "@context": "https://schema.org",
        "@type": "DrivingSchool",
        "name": place.displayName,
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": place.rating,
            "reviewCount": place.reviews.length
        },
        "review": place.reviews.slice(0, 5).map(r => ({
            "@type": "Review",
            "author": {
                "@type": "Person",
                "name": r.authorAttribution.displayName
            },
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": r.rating
            },
            "reviewBody": r.text.text
        }))
    };

    const script = document.createElement("script");
    script.id = "review-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
}


function initMaps() {
    document.querySelector(".nav.next").onclick = () => {
        currentIndex++;
        updateCarousel();
    };

    document.querySelector(".nav.prev").onclick = () => {
        currentIndex = Math.max(0, currentIndex - 1);
        updateCarousel();
    };

    document.getElementById("branchSelect").onchange = e => {
        loadReviews(BRANCHES[e.target.value]);
    };

    loadReviews(BRANCHES.vandematram);
}

window.initMaps = initMaps;
