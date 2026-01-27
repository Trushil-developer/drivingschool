async function loadPackages() {
    const container = document.querySelector('.packages-grid');
    if (!container) return;

    container.innerHTML = '<p>Loading packages...</p>';

    try {
        const res = await fetch('/api/packages');
        const data = await res.json();

        if (!data.success || !data.packages.length) {
            container.innerHTML = '<p>No packages found.</p>';
            return;
        }

        container.innerHTML = data.packages.map(pkg => {
            // Parse JSON safely for extra features
            let extraFeatures = '';
            if (pkg.extra_features) {
                try {
                    const featuresObj = typeof pkg.extra_features === 'string'
                        ? JSON.parse(pkg.extra_features)
                        : pkg.extra_features;
                    extraFeatures = Object.values(featuresObj)
                        .map(f => `<li>${f}</li>`)
                        .join('');
                } catch (err) {
                    console.error('Invalid JSON for package extra_features', err);
                }
            }

            // All packages have highlight border
            const highlightClass = 'highlight';

            // Determine badge color class
            let badgeClass = 'success'; // default green
            if (pkg.badge?.toLowerCase().includes('popular')) badgeClass = 'premium';

            return `
                <article class="package-card ${highlightClass}">
                    ${pkg.badge ? `<span class="badge ${badgeClass}">${pkg.badge}</span>` : ''}
                    <h2 class="package-title">${pkg.title}</h2>
                    <p class="package-desc">${pkg.description || ''}</p>
                    <ul class="package-features">
                        ${pkg.practical_sessions ? `<li>${pkg.practical_sessions} Practical Sessions</li>` : ''}
                        ${pkg.session_duration ? `<li>${pkg.session_duration} per Session</li>` : ''}
                        ${pkg.daily_distance ? `<li>${pkg.daily_distance} Daily Practice</li>` : ''}
                        ${extraFeatures}
                    </ul>
                    <button class="btn-book" onclick="bookNow(${pkg.practical_sessions})">Book Now</button>
                </article>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading packages:', err);
        container.innerHTML = '<p>Failed to load packages. Try again later.</p>';
    }
}

document.addEventListener('DOMContentLoaded', loadPackages);

function bookNow(trainingDays) {
    if (!trainingDays) return;
    window.location.href = `/register.html?training_days=${trainingDays}`;
}
