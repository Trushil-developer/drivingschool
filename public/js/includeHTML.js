// includeHTML.js
function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    elements.forEach(async el => {
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
    });
}

document.addEventListener("DOMContentLoaded", includeHTML);
