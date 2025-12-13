// includeHTML.js
async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    
    for (const el of elements) {
        const file = el.getAttribute('data-include');
        if (file) {
            try {
                const response = await fetch(file);
                if (!response.ok) throw new Error(`Could not load ${file}`);
                const text = await response.text();
                el.innerHTML = text;
            } catch (err) {
                console.error(err);
            }
        }
    }

    // Initialize hamburger menu AFTER HTML has been loaded
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("open");
        });
    }
}

document.addEventListener("DOMContentLoaded", includeHTML);
