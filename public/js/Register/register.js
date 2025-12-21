(function enforceTrainingDaysGuard() {
    const params = new URLSearchParams(window.location.search);

    const trainingDays =
        history.state?.training_days ||
        window.training_days ||
        sessionStorage.getItem("training_days") ||
        localStorage.getItem("training_days") ||
        params.get("training_days");

    if (!trainingDays) {
        window.location.replace("index.html");
    }
})();

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
    instructor: { knows: null, name: ""},
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
const instructorSection = document.getElementById("instructorSection");
const instructorButtons = document.querySelectorAll(".instructor-btn");
const instructorSelect = document.getElementById("instructorSelect");
const instructorSelectWrap = document.getElementById("instructorSelectWrap");
const noInstructorInfo = document.getElementById("noInstructorInfo");

/* NAVIGATION BUTTONS */
const goToDateBtn = document.getElementById("goToDate");
const goToLicenceBtn = document.getElementById("goToLicence");
const goToPersonalBtn = document.getElementById("goToPersonal");
const goToAddonFromInstructorBtn = document.getElementById("goToAddonFromInstructor");

const backToBranchesBtn = document.getElementById("backToBranch");
const backToCarsBtn = document.getElementById("backToCars");
const backToDateBtn = document.getElementById("backToDate");
const backToLicenceBtn = document.getElementById("backToLicence");
const backToLicenceFromAddonBtn = document.getElementById("backToLicenceFromAddon");
const backToAddonBtn = document.getElementById("backToAddon");

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
    attachInstructorEvents();
}

/* =====================================================
   SECTION CONTROL
===================================================== */
function showSection(section) {
    const allSections = [branchSection, carsSection, dateSection, licenceSection, instructorSection, addonSection, personalSection];
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
        case "instructor": target = instructorSection; break;
        case "addon": target = addonSection; break;
        case "personal": target = personalSection; break;
    }

    if(target) {
        target.hidden = false;
        target.classList.add("active");
    }

    // Update step indicator
    document.querySelectorAll(".step-indicator .step").forEach((el) => el.classList.remove("active"));
    const stepMap = { branch: 0, cars: 1, date: 2, licence: 3,  instructor: 4, addon: 5, personal: 6 };
    const currentStep = stepMap[section] + 1;
    const totalSteps = 7;

    /* Desktop indicator */
    const stepEl = document.querySelector(`.step-indicator .step:nth-child(${currentStep})`);
    if (stepEl) stepEl.classList.add("active");

    /* Mobile progress */
    const stepText = document.querySelector(".mobile-step-text");
    const progressFill = document.querySelector(".mobile-progress-fill");

    if (stepText && progressFill) {
        stepText.textContent = `Step ${currentStep} of ${totalSteps}`;
        progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;
    }
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
                <div class="branch-name">${b.branch_name}</div>
                <div class="branch-action">Select</div>
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
            <div class="car-card" data-car="${car.car_name}" data-price="${car.price_15_days}">
                <div class="car-card-body">
                    <div class="car-name">${car.car_name}</div>
                    <div class="car-price">₹${car.price_15_days}</div>
                    <div class="car-price-note">15 days package</div>
                </div>
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
    backToLicenceFromAddonBtn && (backToLicenceFromAddonBtn.onclick = () => showSection("instructor"));
    backToAddonBtn && (backToAddonBtn.onclick = () => showSection("addon"));

    durationSelect.onchange = () => {
        if (!durationSelect.value) return;
        state.duration = Number(durationSelect.value);
        generateTimeSlots();
        timeSlotContainer.hidden = false;
    };
    document.querySelectorAll(".duration-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".duration-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            durationSelect.value = chip.dataset.value;
            durationSelect.dispatchEvent(new Event("change"));
        });
    });


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

            const noLicenceInfo = document.getElementById("noLicenceInfo");
            
            if (state.hasLicence === "yes") {
                licenceDetails.hidden = false;   
                noLicenceInfo.hidden = true;
            } else {
                licenceDetails.hidden = true;  
                noLicenceInfo.hidden = false;

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

        showSection("instructor");
    });
}

/* =====================================================
   INSTUCTORS EVENTS
===================================================== */

function attachInstructorEvents() {

    instructorButtons.forEach(btn => {
        btn.onclick = () => {
            instructorButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            state.instructor.knows = btn.dataset.value;

            if (state.instructor.knows === "yes") {
                instructorSelectWrap.hidden = false;
                noInstructorInfo.hidden = true;
                loadInstructors();
            } else {
                instructorSelectWrap.hidden = true;
                noInstructorInfo.hidden = false;
                state.instructor.name = "";
            }
        };
    });

    goToAddonFromInstructorBtn.onclick = () => {
        if (state.instructor.knows === "yes" && !state.instructor.name) {
            return alert("Please select instructor");
        }
        showSection("addon");
    };

    instructorSelect.onchange = () => {
        state.instructor.name = instructorSelect.value;
    };
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
let isSubmitting = false;

function attachPersonalSubmit() {
    submitBookingBtn.onclick = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        /* =============================
           COLLECT PERSONAL DATA
        ============================== */
        const get = (id) => document.getElementById(id)?.value.trim() || "";

        state.personalData = {
            fullName: get("fullName").toUpperCase(),
            mobile: get("mobile"),
            email: get("email"),
            address: get("address").toUpperCase(),
            pinCode: get("pinCode"),
            sex: get("sex"),
            birthDate: get("birthDate"),
            occupation: get("occupation").toUpperCase(),
            reference: get("reference").toUpperCase()
        };

        /* =============================
           AGE VALIDATION (16+)
        ============================== */
        const isAtLeastYearsOld = (dateStr, years) => {
            const birth = new Date(dateStr);
            const today = new Date();
            birth.setFullYear(birth.getFullYear() + years);
            return birth <= today;
        };

        if (!state.personalData.birthDate || !isAtLeastYearsOld(state.personalData.birthDate, 16)) {
            return alert("You must be at least 16 years old.");
        }

        /* =============================
           FORMAT TIME (HH:mm:ss)
        ============================== */
        let allotted_time = "";
        if (state.timeSlot) {
            const [time, modifier] = state.timeSlot.split(" ");
            let [hours, minutes] = time.split(":").map(Number);
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            allotted_time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
        }

        /* =============================
           BUILD BACKEND PAYLOAD
           (OLD API COMPATIBLE)
        ============================== */
        const body = {
            branch: state.branch,
            training_days: getTrainingDaysFromProps(),
            car_name: state.car,

            ac_facility: state.addons.ac ? 1 : 0,
            pickup_drop: state.addons.pickup ? 1 : 0,
            has_licence: state.hasLicence === "yes" ? "yes" : "no",

            customer_name: state.personalData.fullName,
            address: state.personalData.address,
            pincode: state.personalData.pinCode,
            mobile_no: state.personalData.mobile,
            whatsapp_no: state.personalData.mobile,

            sex: state.personalData.sex,
            birth_date: state.personalData.birthDate,
            email: state.personalData.email,
            occupation: state.personalData.occupation,
            ref: state.personalData.reference || "",

            dl_no: state.hasLicence === "yes" ? state.licenceData.dlNo : "",
            dl_from: state.hasLicence === "yes" ? state.licenceData.from : "",
            dl_to: state.hasLicence === "yes" ? state.licenceData.to : "",

            instructor_name: state.instructor.name || null,

            cov_lmv: false,
            cov_mc: false,

            starting_from: state.date,
            allotted_time,
            duration_minutes: state.duration,

            total_fees: state.totalPrice,
            advance: 0
        };

        /* =============================
           FINAL REQUIRED CHECKS
        ============================== */
        if (!body.branch) return alert("Please select branch.");
        if (!body.car_name) return alert("Please select car.");
        if (!body.starting_from) return alert("Please select start date.");
        if (!body.allotted_time) return alert("Please select time slot.");
        if (!body.duration_minutes) return alert("Please select duration.");

        /* =============================
           SUBMIT
        ============================== */
        isSubmitting = true;
        submitBookingBtn.disabled = true;

        try {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Submission failed");
            }

            console.log("Booking submitted:", body);
            alert("Booking submitted successfully!");
        } catch (err) {
            console.error(err);
            alert("Server error. Please try again later.");
        } finally {
            isSubmitting = false;
            submitBookingBtn.disabled = false;
        }
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

function getTrainingDaysFromProps() {
    if (history.state?.training_days) {
        return String(history.state.training_days);
    }

    if (window.training_days) {
        return String(window.training_days);
    }

    const sessionValue = sessionStorage.getItem("training_days");
    if (sessionValue) return sessionValue;

    const localValue = localStorage.getItem("training_days");
    if (localValue) return localValue;

    const params = new URLSearchParams(window.location.search);
    if (params.has("training_days")) {
        return params.get("training_days");
    }

    return "15";
}

async function loadInstructors() {
    try {
        const res = await fetch("/api/instructors");
        const data = await res.json();

        const filtered = data.instructors.filter(i => i.branch === state.branch && i.is_active);

        if (filtered.length === 0) {
            instructorSelect.innerHTML = `<option value="">No instructors available for this branch</option>`;
            return;
        }

        instructorSelect.innerHTML = `
            <option value="">Select Instructor</option>
            ${filtered.map(i => `<option value="${i.instructor_name}">${i.instructor_name}</option>`).join("")}
        `;
    } catch {
        instructorSelect.innerHTML = `<option value="">Unable to load instructors</option>`;
    }
}

