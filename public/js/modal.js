// model.js
window.Modal = (() => {
    let modalEl = null;
    let contentEl = null;
    let overlayEl = null;

    function init() {
        if (modalEl) return; // already initialized

        // Create overlay
        overlayEl = document.createElement('div');
        overlayEl.id = 'modalOverlay';
        overlayEl.style.position = 'fixed';
        overlayEl.style.top = 0;
        overlayEl.style.left = 0;
        overlayEl.style.width = '100%';
        overlayEl.style.height = '100%';
        overlayEl.style.background = 'rgba(0,0,0,0.5)';
        overlayEl.style.display = 'none';
        overlayEl.style.zIndex = '999';
        overlayEl.addEventListener('click', hide);

        // Create modal container
        modalEl = document.createElement('div');
        modalEl.id = 'modalContainer';
        modalEl.style.position = 'fixed';
        modalEl.style.top = '50%';
        modalEl.style.left = '50%';
        modalEl.style.transform = 'translate(-50%, -50%)';
        modalEl.style.background = '#fff';
        modalEl.style.padding = '20px';
        modalEl.style.borderRadius = '8px';
        modalEl.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        modalEl.style.minWidth = '300px';
        modalEl.style.maxWidth = '90%';
        modalEl.style.display = 'none';
        modalEl.style.zIndex = '1000';

        // Content container
        contentEl = document.createElement('div');
        contentEl.id = 'modalContent';
        modalEl.appendChild(contentEl);

        // Close button
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '15px';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', hide);
        modalEl.appendChild(closeBtn);

        document.body.appendChild(overlayEl);
        document.body.appendChild(modalEl);
    }

    function setContent(html) {
        if (!contentEl) {
            console.error("Modal not initialized. Call Modal.init() first.");
            return;
        }
        contentEl.innerHTML = html;
    }

    function show() {
        if (!modalEl || !overlayEl) {
            console.error("Modal not initialized. Call Modal.init() first.");
            return;
        }
        overlayEl.style.display = 'block';
        modalEl.style.display = 'block';
    }

    function hide() {
        if (!modalEl || !overlayEl) return;
        overlayEl.style.display = 'none';
        modalEl.style.display = 'none';
    }

    return {
        init,
        setContent,
        show,
        hide,
        get el() { return modalEl; }
    };
})();
