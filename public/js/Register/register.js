document.addEventListener("DOMContentLoaded", init);

/* =====================================================
   GLOBAL STATE
===================================================== */
let state = {
    branch: null,
    car: null,
    carPrice: 0,
    addons: { ac: false, pickup: false },
    addonPrice: 1000,
    totalPrice: 0,
    date: null,
    duration: null,
    timeSlot: null,
    hasLicence: null,
    licenceData: { dlNo: "", from: "", to: "" },
    personalData: {
        fullName: "",
        mobile: "",
        email: "",
        address: "",
        pinCode: "",
        sex: "",
        birthDate: "",
        occupation: "",
        reference: ""
    }
};

/* =====================================================
   ELEMENTS
===================================================== */
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
const goToAddonBtn = document.getElementById("goToAddon");

const addonSection = document.getElementById("addonSection");
const addonButtons = document.querySelectorAll(".addon-btn");

const personalSection = document.getElementById("personalSection");
const submitBookingBtn = document.getElementById("submitBooking");

/* NAVIGATION BUTTONS */
const goToDateBtn = document.getElementById("goToDate");
const goToLicenceBtn = document.getElementById("goToLicence");
const goToPersonalBtn = document.getElementById("goToPersonal");

const backToBranchesBtn = document.getElementById("backToBranch");
const backToCarsBtn = document.getElementById("backToCars");
const backToDateBtn = document.getElementById("backToDate");
const backToLicenceBtn = document.getElementById("backToLicence");
const backToLicenceFromAddonBtn = document.getElementById("backToLicenceFromAddon");

/* =====================================================
   INIT
===================================================== */
function init() {
    loadBranches();
    showSection("branch");

    timeSlotContainer.hidden = true;
    goToLicenceBtn && (goToLicenceBtn.hidden = true);

    attachNavigationEvents();
    attachAddonEvents();
    attachLicenceEvents();
    attachPersonalSubmit();
}

/* =====================================================
   SECTION CONTROL
===================================================== */
function showSection(section) {
    const allSections = [branchSection, carsSection, dateSection, licenceSection, addonSection, personalSection];
    allSections.forEach(s => {
        s.hidden = true;
        s.classList.remove("active");
    });

    let target;
    switch(section) {
        case "branch": target = branchSection; break;
        case "cars": target = carsSection; break;
        case "date": target = dateSection; break;
        case "licence": target = licenceSection; break;
        case "addon": target = addonSection; break;
        case "personal": target = personalSection; break;
    }

    if(target) {
        target.hidden = false;
        target.classList.add("active");
    }

    // Update step indicator
    document.querySelectorAll(".step-indicator .step").forEach((el) => el.classList.remove("active"));
    const stepMap = { branch: 0, cars: 1, date: 2, licence: 3, addon: 4, personal: 5 };
    const stepEl = document.querySelector(`.step-indicator .step:nth-child(${stepMap[section]+1})`);
    if(stepEl) stepEl.classList.add("active");
}

/* =====================================================
   LOAD BRANCHES
===================================================== */
async function loadBranches() {
    try {
        const res = await fetch("/api/branches");
        if (!res.ok) throw new Error("Failed to load branches");
        const data = await res.json();

        if (!data.branches || data.branches.length === 0) {
            branchGrid.innerHTML = "<p>No branches found.</p>";
            return;
        }

        branchGrid.innerHTML = data.branches.map(b => `
            <div class="branch-card" data-branch="${b.branch_name}">
                <h3>${b.branch_name}</h3>
            </div>
        `).join("");

        document.querySelectorAll(".branch-card").forEach(card => {
            card.onclick = async () => {
                state.branch = card.dataset.branch;
                document.querySelectorAll(".branch-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");

                try { await loadCars(); } catch (e) { console.warn(e); }
                showSection("cars");
            };
        });
    } catch (err) {
        console.error(err);
        branchGrid.innerHTML = "<p>Unable to load branches. Please try again later.</p>";
    }
}

/* =====================================================
   LOAD CARS
===================================================== */
async function loadCars() {
    try {
        const res = await fetch("/api/cars");
        if (!res.ok) throw new Error("Failed to load cars");
        const data = await res.json();

        const cars = data.cars?.filter(c => c.branch === state.branch && !c.inactive) || [];
        if (!cars.length) {
            carsGrid.innerHTML = "<p>No cars available for this branch.</p>";
            return;
        }

        carsGrid.innerHTML = cars.map(car => `
            <div class="branch-card car-card" data-car="${car.car_name}" data-price="${car.price_15_days}">
                <h3>${car.car_name}</h3>
                <p>Price: ₹${car.price_15_days}</p>
            </div>
        `).join("");

        document.querySelectorAll(".car-card").forEach(card => {
            card.onclick = () => {
                state.car = card.dataset.car;
                state.carPrice = Number(card.dataset.price);
                updateTotalPrice();

                document.querySelectorAll(".car-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
            };
        });

    } catch (err) {
        console.error(err);
        carsGrid.innerHTML = "<p>Unable to load cars. Please try again later.</p>";
    }
}

/* =====================================================
   NAVIGATION EVENTS
===================================================== */
function attachNavigationEvents() {
    goToDateBtn && (goToDateBtn.onclick = () => {
        if (!state.car) return alert("Please select a car to proceed");
        showSection("date");
    });

    backToBranchesBtn && (backToBranchesBtn.onclick = () => showSection("branch"));
    backToCarsBtn && (backToCarsBtn.onclick = () => showSection("cars"));
    backToDateBtn && (backToDateBtn.onclick = () => showSection("date"));
    backToLicenceBtn && (backToLicenceBtn.onclick = () => showSection("licence"));
    backToLicenceFromAddonBtn && (backToLicenceFromAddonBtn.onclick = () => showSection("licence"));

    durationSelect.onchange = () => {
        if (!durationSelect.value) return;
        state.duration = Number(durationSelect.value);
        generateTimeSlots();
        timeSlotContainer.hidden = false;
    };

    goToLicenceBtn && (goToLicenceBtn.onclick = () => {
        if (!startDateInput.value || !state.duration || !state.timeSlot) {
            return alert("Please select date, duration, and time slot first");
        }
        state.date = startDateInput.value;
        showSection("licence");
    });

    goToPersonalBtn && (goToPersonalBtn.onclick = () => showSection("personal"));
}

/* =====================================================
   TIME SLOTS
===================================================== */
function generateTimeSlots() {
    timeSlotsGrid.innerHTML = "";
    state.timeSlot = null;

    for (let h = 6; h < 22; h++) {
        for (let m of [0, 30]) {
            const time = formatTime(h, m);
            const slot = document.createElement("div");
            slot.className = "time-slot";
            slot.textContent = time;

            slot.onclick = () => {
                document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("active"));
                slot.classList.add("active");
                state.timeSlot = time;
                goToLicenceBtn && (goToLicenceBtn.hidden = false);
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
   LICENCE EVENTS
===================================================== */
function attachLicenceEvents() {
    goToAddonBtn.disabled = true; 

    licenceButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            licenceButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            state.hasLicence = btn.dataset.value;

            if (state.hasLicence === "yes") {
                licenceDetails.hidden = false;
            } else {
                licenceDetails.hidden = true;
                state.licenceData = { dlNo: "", from: "", to: "" };
                document.getElementById("dlNumber").value = "";
                document.getElementById("dlFrom").value = "";
                document.getElementById("dlTo").value = "";
            }

            goToAddonBtn.disabled = false;
        });
    });

    goToAddonBtn && (goToAddonBtn.onclick = () => {
        if (state.hasLicence === "yes") {
            const dlNo = document.getElementById("dlNumber").value.trim();
            const dlFrom = document.getElementById("dlFrom").value;
            const dlTo = document.getElementById("dlTo").value;

            if (!dlNo || !dlFrom || !dlTo) return alert("Please fill all licence details");

            state.licenceData = { dlNo, from: dlFrom, to: dlTo };
        }

        showSection("addon");
    });
}

/* =====================================================
   ADD-ON EVENTS
===================================================== */
function attachAddonEvents() {
    addonButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const addon = btn.dataset.addon;
            const value = btn.dataset.value;

            document.querySelectorAll(`.addon-btn[data-addon="${addon}"]`).forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            state.addons[addon] = (value === "yes");
            updateTotalPrice();
        });
    });
}

/* =====================================================
   PERSONAL SUBMIT
===================================================== */
function attachPersonalSubmit() {
    submitBookingBtn.onclick = () => {
        const inputs = personalSection.querySelectorAll("input, select");
        let valid = true;

        inputs.forEach(input => {
            const val = input.value.trim();
            if (!val && input.required !== false) {
                valid = false;
                input.style.borderColor = "red";
            } else {
                input.style.borderColor = "";
                if (input.id) state.personalData[input.id] = val;
            }
        });

        if (!valid) return alert("Please fill all personal information");

        const bookingData = {
            branch: state.branch,
            car: state.car,
            totalPrice: state.totalPrice,
            date: startDateInput.value,
            duration: state.duration,
            timeSlot: state.timeSlot,
            hasLicence: state.hasLicence,
            licenceData: state.licenceData,
            addons: state.addons,
            personalData: state.personalData
        };

        console.log("Booking Data:", bookingData);
        alert("Booking submitted successfully!");
        // TODO: send bookingData to backend
    };
}

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
function updateTotalPrice() {
    // Calculate total price
    let price = state.carPrice;
    if (state.addons.ac) price += state.addonPrice;
    if (state.addons.pickup) price += state.addonPrice;
    state.totalPrice = price;

    // Update all total-price elements
    const priceEls = document.querySelectorAll(".total-price");
    priceEls.forEach(el => {
        // Hide in branch section
        const section = el.closest(".form-step");
        if (section.id === "branchSection") {
            el.style.display = "none";
        } else {
            el.style.display = "block";
            el.textContent = `₹${state.totalPrice}`;
        }
    });
}



