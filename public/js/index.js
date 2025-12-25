function bookNow(trainingDays) {
    if (!trainingDays) {
        console.error("Training days not provided");
        return;
    }

    // Optional: Google Analytics event tracking
    if (typeof gtag === "function") {
        gtag("event", "book_now_click", {
            event_category: "engagement",
            event_label: `${trainingDays}_days_course`
        });
    }

    // Redirect with query parameter
    const params = new URLSearchParams({
        training_days: trainingDays
    });

    window.location.href = `register.html?${params.toString()}`;
}
