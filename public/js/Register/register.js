document.addEventListener("DOMContentLoaded", init);

/* =====================================================
   GLOBAL STATE
===================================================== */
let selectedBranch = null;
let selectedCar = null;
let totalPrice = 0;
let selectedTimeSlot = null;
let hasLicence = null;
let addons = {
    ac: false,
    pickup: false
};

const ADDON_PRICE = 1000;


let licenceData = { dlNo: "", from: "", to: "" };

/* =====================================================
   ELEMENTS
===================================================== */
const globalHeader = document.getElementById("globalHeader");
const sectionTitle = document.getElementById("sectionTitle");

const branchSection = document.getElementById("branchSection");
const branchGrid = document.getElementById("branchCheckboxGroup");

const carsSection = document.getElementById("carsSection");
const carsGrid = document.getElementById("carsGrid");

const dateSection = document.getElementById("dateSection");
const startDateInput = document.getElementById("startDate");
const durationSelect = document.getElementById("durationSelect");
const timeSlotContainer = document.getElementById("timeSlotContainer");
const timeSlotsGrid = document.getElementById("timeSlotsGrid");

const licenceSection = document.getElementById("licenceSection");
const licenceButtons = document.querySelectorAll(".licence-btn");
const licenceDetails = document.getElementById("licenceDetails");

const personalSection = document.getElementById("personalSection");

const goToLicenceBtn = document.getElementById("goToLicence");
const goToSummaryBtn = document.getElementById("goToSummary");
const submitBookingBtn = document.getElementById("submitBooking");

/* =====================================================
   INIT
===================================================== */
function init() {
    loadBranches();
    showSection("branch");

    timeSlotContainer.hidden = true;
    goToLicenceBtn.hidden = true;
    goToSummaryBtn.hidden = true;

    document.querySelector(".inline-price-card").style.display = "none";
}

/* =====================================================
   SECTION CONTROL
===================================================== */
function showSection(section) {
    // Hide all
    branchSection.hidden = true;
    carsSection.hidden = true;
    dateSection.hidden = true;
    licenceSection.hidden = true;
    personalSection.hidden = true;
    addonSection.hidden = true;

    // Branch = no global header
    if (section === "branch") {
        globalHeader.hidden = true;
        branchSection.hidden = false;
        return;
    }

    // Other sections
    globalHeader.hidden = false;

    if (section === "cars") {
        sectionTitle.textContent = "Select a Car";
        carsSection.hidden = false;
    }

    if (section === "date") {
        sectionTitle.textContent = "Select Start Date & Time";
        dateSection.hidden = false;
    }

    if (section === "licence") {
        sectionTitle.textContent = "Licence Information";
        licenceSection.hidden = false;
    }

    if (section === "personal") {
        sectionTitle.textContent = "Personal Information";
        personalSection.hidden = false;
    }

    if (section === "addon") {
        sectionTitle.textContent = "Premium Add-On Services";
        addonSection.hidden = false;
    }
}

/* =====================================================
   LOAD BRANCHES
===================================================== */
async function loadBranches() {
    const res = await fetch("/api/branches");
    const data = await res.json();

    branchGrid.innerHTML = data.branches.map(b => `
        <div class="branch-card" data-branch="${b.branch_name}">
            <h3>${b.branch_name}</h3>
        </div>
    `).join("");

    document.querySelectorAll(".branch-card").forEach(card => {
        card.onclick = async () => {
            selectedBranch = card.dataset.branch;

            document.querySelectorAll(".branch-card")
                .forEach(c => c.classList.remove("active"));
            card.classList.add("active");

            await loadCars();
            showSection("cars");
        };
    });
}

/* =====================================================
   LOAD CARS
===================================================== */
async function loadCars() {
    const res = await fetch("/api/cars");
    const data = await res.json();

    carsGrid.innerHTML = data.cars
        .filter(c => c.branch === selectedBranch && !c.inactive)
        .map(car => `
            <div class="branch-card car-card"
                 data-car="${car.car_name}"
                 data-price="${car.price_15_days}">
                <h3>${car.car_name}</h3>
                <p>Price: ₹${car.price_15_days}</p>
            </div>
        `).join("");

    document.querySelectorAll(".car-card").forEach(card => {
        card.onclick = () => {
            selectedCar = card.dataset.car;
            totalPrice = Number(card.dataset.price);

            document.querySelectorAll(".car-card")
                .forEach(c => c.classList.remove("active"));
            card.classList.add("active");

            document.querySelector(".inline-price-card").style.display = "block";
            document.getElementById("totalPrice").textContent = `₹${totalPrice}`;
        };
    });
}

/* =====================================================
   NAVIGATION
===================================================== */
document.getElementById("goToDate").onclick = () => {
    if (!selectedCar) return alert("Select a car");
    showSection("date");
};

document.getElementById("backToBranches").onclick = () => showSection("branch");
document.getElementById("backToCars").onclick = () => showSection("cars");
document.getElementById("backToDate").onclick = () => showSection("date");
document.getElementById("backToLicence").onclick = () => showSection("licence");

/* =====================================================
   DATE / TIME
===================================================== */
durationSelect.onchange = () => {
    if (!durationSelect.value) return;
    generateTimeSlots();
    timeSlotContainer.hidden = false;
};

function generateTimeSlots() {
    timeSlotsGrid.innerHTML = "";
    selectedTimeSlot = null;

    for (let h = 6; h < 22; h++) {
        for (let m of [0, 30]) {
            const time = formatTime(h, m);
            const slot = document.createElement("div");
            slot.className = "time-slot";
            slot.textContent = time;

            slot.onclick = () => {
                document.querySelectorAll(".time-slot")
                    .forEach(s => s.classList.remove("active"));
                slot.classList.add("active");
                selectedTimeSlot = time;
                goToLicenceBtn.hidden = false;
            };

            timeSlotsGrid.appendChild(slot);
        }
    }
}

function formatTime(h, m) {
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

/* =====================================================
   LICENCE
===================================================== */

// Initial state
licenceDetails.hidden = true;
goToSummaryBtn.hidden = true;

goToLicenceBtn.onclick = () => showSection("licence");

licenceButtons.forEach(btn => {
    btn.addEventListener("click", () => {

        // Remove active state from both buttons
        licenceButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        hasLicence = btn.dataset.value;

        if (hasLicence === "yes") {
            licenceDetails.classList.add("show");
        } else {
            licenceDetails.classList.remove("show");
            document.getElementById("dlNumber").value = "";
            document.getElementById("dlFrom").value = "";
            document.getElementById("dlTo").value = "";
        }

        // Enable next button only after selection
        goToSummaryBtn.hidden = false;
    });
});


goToSummaryBtn.onclick = () => {
    showSection("addon");
};

/* =====================================================
   Add-on
===================================================== */


const addonSection = document.getElementById("addonSection");
const addonButtons = document.querySelectorAll(".addon-btn");

const goToPersonalBtn = document.getElementById("goToPersonal");
const backToLicenceFromAddonBtn = document.getElementById("backToLicenceFromAddon");

addonButtons.forEach(btn => {
    btn.addEventListener("click", () => {

        const addon = btn.dataset.addon;
        const value = btn.dataset.value;

        // reset buttons for same addon
        document
            .querySelectorAll(`.addon-btn[data-addon="${addon}"]`)
            .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        if (value === "yes") {
            if (!addons[addon]) {
                addons[addon] = true;
                totalPrice += ADDON_PRICE;
            }
        } else {
            if (addons[addon]) {
                addons[addon] = false;
                totalPrice -= ADDON_PRICE;
            }
        }

        document.getElementById("totalPrice").textContent = `₹${totalPrice}`;
    });
});

goToPersonalBtn.onclick = () => {
    showSection("personal");
};

backToLicenceFromAddonBtn.onclick = () => {
    showSection("licence");
};


/* =====================================================
   SUBMIT
===================================================== */
submitBookingBtn.onclick = () => {
    console.log({
        branch: selectedBranch,
        car: selectedCar,
        price: totalPrice,
        date: startDateInput.value,
        duration: durationSelect.value,
        time: selectedTimeSlot,
        hasLicence
    });

    alert("Booking submitted successfully!");
};
