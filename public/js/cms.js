(async () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    const titleEl = document.getElementById("cmsTitle");
    const contentEl = document.getElementById("cmsContent");

    if (!slug) {
        titleEl.textContent = "Page Not Found";
        contentEl.innerHTML = "<p>Invalid page.</p>";
        return;
    }

    try {
        const res = await fetch(`/api/cms/${slug}`);
        const data = await res.json();

        if (!data.success) throw new Error("Page not found");

        titleEl.textContent = data.page.title;
        contentEl.innerHTML = data.page.content;

        // Optional SEO
        document.title = `${data.page.title} | Dwarkesh Motor Driving School`;

    } catch (err) {
        titleEl.textContent = "Page Not Found";
        contentEl.innerHTML = "<p>Sorry, the page does not exist.</p>";
    }
})();
