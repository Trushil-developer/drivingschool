export const Modal = {
    init() {
        this.el = document.getElementById("appModal");
        if (!this.el) throw new Error("Modal element not found");

        this.inner = this.el.querySelector(".modal-inner");
        this.closeBtn = this.el.querySelector(".modal-close");

        this.closeBtn?.addEventListener("click", () => this.hide());

    },

    setContent(html) {
        if (!this.inner) throw new Error("Modal inner element not found");
        this.inner.innerHTML = html;
    },

    show() {
        this.el.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    },

    hide() {
        this.el.classList.add("hidden");
        document.body.style.overflow = "";
    }
};
