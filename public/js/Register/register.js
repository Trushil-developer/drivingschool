/* =====================================================
   TRAINING DAYS GUARD
===================================================== */
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

/* =====================================================
   DOM CONTENT LOADED
===================================================== */
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
    selectedSlots: [],    
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
const goToInstructorBtn = document.getElementById("goToInstructor");

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

const SELECTED_TRAINING_DAYS = Number(getTrainingDaysFromProps());


/* =====================================================
   INIT FUNCTION
===================================================== */
function init() {
    loadBranches();
    showSection("branch");

    timeSlotContainer.hidden = true;
    goToLicenceBtn && (goToLicenceBtn.hidden = true);
    goToDateBtn.hidden = true
    goToInstructorBtn.hidden = true; 
    goToAddonFromInstructorBtn.hidden = true;

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
    const allSections = [
        branchSection,
        carsSection,
        dateSection,
        licenceSection,
        instructorSection,
        addonSection,
        personalSection
    ];

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

    // Desktop indicator
    const stepEl = document.querySelector(`.step-indicator .step:nth-child(${currentStep})`);
    if (stepEl) stepEl.classList.add("active");

    // Mobile progress
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
                // NEW: reset downstream data
                resetDateAndSlots();

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

        carsGrid.innerHTML = cars.map(car => {
            const price = getPriceByDays(car, SELECTED_TRAINING_DAYS);

            return `
                <div class="car-card"
                    data-car="${car.car_name}"
                    data-price="${price}">
                    <div class="car-card-body">
                        <div class="car-name">${car.car_name}</div>
                        <div class="car-price">₹${price}</div>
                        <div class="car-price-note">
                            ${SELECTED_TRAINING_DAYS} days package
                        </div>
                    </div>
                </div>
            `;
        }).join("");


        document.querySelectorAll(".car-card").forEach(card => {
            card.onclick = () => {
                // ✅ RESET EVERYTHING THAT DEPENDS ON CAR
                resetDateAndSlots();

                state.car = card.dataset.car;
                state.carPrice = Number(card.dataset.price);
                updateTotalPrice();

                document.querySelectorAll(".car-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");

                goToDateBtn.hidden = false;
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

function getPriceByDays(car, days) {
    switch (Number(days)) {
        case 15: return car.price_15_days;
        case 21: return car.price_21_days;
        default: return car.price_15_days;
    }
}

function attachNavigationEvents() {
    goToDateBtn && (goToDateBtn.onclick = () => {
        if (!validateCarSection()) return;
        showSection("date");
    });

    backToBranchesBtn && (backToBranchesBtn.onclick = () => showSection("branch"));
    backToCarsBtn && (backToCarsBtn.onclick = () => showSection("cars"));
    backToDateBtn && (backToDateBtn.onclick = () => showSection("date"));
    backToLicenceBtn && (backToLicenceBtn.onclick = () => showSection("licence"));
    backToLicenceFromAddonBtn && (backToLicenceFromAddonBtn.onclick = () => showSection("instructor"));
    backToAddonBtn && (backToAddonBtn.onclick = () => showSection("addon"));

    durationSelect.onchange = async () => {
        if (!durationSelect.value) return;

        state.duration = Number(durationSelect.value);
        resetSlots(); 

        if (startDateInput.value) {
            timeSlotContainer.hidden = false;
            await generateTimeSlots();
        } else {
            timeSlotContainer.hidden = true;
        }
    };

    startDateInput.addEventListener("change", async () => {
        if (!state.branch || !state.car || !startDateInput.value || !state.duration) return;
        resetSlots();
        timeSlotContainer.hidden = false;
        await generateTimeSlots();
    });

    document.querySelectorAll(".duration-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".duration-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            durationSelect.value = chip.dataset.value;
            durationSelect.dispatchEvent(new Event("change"));
        });
    });

    goToLicenceBtn && (goToLicenceBtn.onclick = () => {
        if (!validateDateSection()) return;
        state.date = startDateInput.value;
        showSection("licence");
    });

    goToPersonalBtn && (goToPersonalBtn.onclick = () => {
        if (!validateAddonSection()) return;
        showSection("personal");
    });
}


/* =====================================================
   TIME SLOTS
===================================================== */

function resetDateAndSlots() {
    // Reset state
    state.date = null;
    state.duration = null;
    state.selectedSlots = [];
    state.timeSlot = null;

    // Reset inputs
    startDateInput.value = "";
    durationSelect.value = "";

    // Reset UI
    timeSlotContainer.hidden = true;
    timeSlotsGrid.innerHTML = "";
    goToLicenceBtn.hidden = true;

    // Reset duration chips
    document.querySelectorAll(".duration-chip").forEach(c =>
        c.classList.remove("active")
    );
}


function requiredSlotCount() {
    return Math.ceil(state.duration / 30);
}

function resetSlots() {
    state.selectedSlots = [];
    state.timeSlot = null;
    goToLicenceBtn.hidden = true;
    document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("active"));
}

async function generateTimeSlots() {
    timeSlotsGrid.innerHTML = "";

    // Get booked slots for current selection
    const bookedSlots = await fetchBookedSlots(state.branch, state.car, startDateInput.value);
    console.log("Booked slots for", state.branch, state.car, startDateInput.value, ":", bookedSlots);


    for (let h = 6; h < 22; h++) {
        for (let m of [0, 30]) {
            const time = formatTime(h, m);
            const slot = document.createElement("div");
            slot.className = "time-slot";
            slot.textContent = time;

            // Disable if already booked
            if (bookedSlots.includes(to24HourFormat(time))) {
                slot.classList.add("disabled");
            } else {
                slot.onclick = () => handleSlotClick(slot, time);
            }

            timeSlotsGrid.appendChild(slot);
        }
    }
}

function to24HourFormat(time12) {
    let [time, mod] = time12.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (mod === "PM" && h !== 12) h += 12;
    if (mod === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`; // add ":00"
}



function handleSlotClick(slot, time) {
    // Prevent selecting slots before selecting a date
    if (!startDateInput.value) {
        alert("Please select a start date first.");
        return;
    }

    if (slot.classList.contains("disabled")) return; // Already booked

    const required = requiredSlotCount();

    // Unselect
    if (slot.classList.contains("active")) {
        slot.classList.remove("active");
        state.selectedSlots = state.selectedSlots.filter(t => t !== time);
        goToLicenceBtn.hidden = true;
        return;
    }

    // Limit selection
    if (state.selectedSlots.length >= required) {
        alert(`Select only ${required} slots for ${state.duration} minutes`);
        return;
    }

    slot.classList.add("active");
    state.selectedSlots.push(time);

    if (state.selectedSlots.length === required) {
        state.timeSlot = getEarliestSlot(state.selectedSlots);
        goToLicenceBtn.hidden = false;
    }
}



/* =====================================================
   HELPERS
===================================================== */
function formatTime(h, m) {
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function getEarliestSlot(slots) {
    const mins = slots.map(toMinutes);
    const min = Math.min(...mins);
    return fromMinutes(min);
}

function toMinutes(time12) {
    let [time, mod] = time12.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (mod === "PM" && h !== 12) h += 12;
    if (mod === "AM" && h === 12) h = 0;
    return h * 60 + m;
}

function fromMinutes(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    const mod = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${mod}`;
}


/* =====================================================
   LICENCE EVENTS
===================================================== */
function attachLicenceEvents() {

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

            goToInstructorBtn.hidden = false;
        });
    });

    goToInstructorBtn && (goToInstructorBtn.onclick = () => {
        if (!validateLicenceSection()) return;
            if (state.hasLicence === "yes") {
                state.licenceData = {
                dlNo: document.getElementById("dlNumber").value.trim(),
                from: document.getElementById("dlFrom").value,
                to: document.getElementById("dlTo").value
            };
        }

        showSection("instructor");
    });
}

/* =====================================================
   INSTRUCTOR EVENTS
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
            goToAddonFromInstructorBtn.hidden = false
        };
    });

    goToAddonFromInstructorBtn && (goToAddonFromInstructorBtn.onclick = () => {
        if (!validateInstructorSection()) return;
        showSection("addon");
    });

    instructorSelect.onchange = () => {
        state.instructor.name = instructorSelect.value;
    };
}

/* =====================================================
   ADD-ON EVENTS
===================================================== */
function attachAddonEvents() {
    const goToPersonalBtn = document.getElementById("goToPersonal"); 

    const selected = { ac: false, pickup: false };

    // Initially hide/disable the button
    if (goToPersonalBtn) {
        goToPersonalBtn.hidden = true;
        goToPersonalBtn.disabled = true;
    }

    addonButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const addon = btn.dataset.addon;
            const value = btn.dataset.value;

            // Mark selection visually
            document.querySelectorAll(`.addon-btn[data-addon="${addon}"]`).forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Update state
            state.addons[addon] = (value === "yes");
            selected[addon] = true;
            updateTotalPrice();

            if (selected.ac && selected.pickup && goToPersonalBtn) {
                goToPersonalBtn.hidden = false;
                goToPersonalBtn.disabled = false;
            }
        });
    });

    // Navigation on clicking Next
    if (goToPersonalBtn) {
        goToPersonalBtn.onclick = () => {
            if (!validateAddonSection()) return;
            showSection("personal");
        };
    }
}


/* =====================================================
   PERSONAL SUBMIT
===================================================== */
let isSubmitting = false;

function attachPersonalSubmit() {
    submitBookingBtn.onclick = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        // Collect personal data
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
            reference: document.getElementById("reference").value || ""
        };

        // Validate phone
        if (!/^[6-9]\d{9}$/.test(state.personalData.mobile)) {
            return alert("Please enter a valid 10-digit mobile number starting with 6-9.");
        }

        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.personalData.email)) {
            return alert("Please enter a valid email address.");
        }

        // Validate pincode
        if (!/^\d{6}$/.test(state.personalData.pinCode)) {
            return alert("Please enter a valid 6-digit pin code.");
        }

        // Validate age (16+)
        const isAtLeastYearsOld = (dateStr, years) => {
            const birth = new Date(dateStr);
            const today = new Date();
            birth.setFullYear(birth.getFullYear() + years);
            return birth <= today;
        };

        if (!state.personalData.birthDate || !isAtLeastYearsOld(state.personalData.birthDate, 16)) {
            return alert("You must be at least 16 years old.");
        }

        // Format time (HH:mm:ss)
        let allotted_time = "";
        if (state.timeSlot) {
            const [time, modifier] = state.timeSlot.split(" ");
            let [hours, minutes] = time.split(":").map(Number);
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            allotted_time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
        }

        // Build backend payload
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
            selected_slots: state.selectedSlots.map(t => {
                let [time, mod] = t.split(" ");
                let [h, m] = time.split(":").map(Number);
                if (mod === "PM" && h !== 12) h += 12;
                if (mod === "AM" && h === 12) h = 0;
                return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
            }),
            total_fees: state.totalPrice,
            advance: 0
        };

        // Final required checks
        if (!body.branch) return alert("Please select branch.");
        if (!body.car_name) return alert("Please select car.");
        if (!body.starting_from) return alert("Please select start date.");

        // Submit
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

            const modal = document.getElementById("successModal");
            modal.style.display = "flex";

            document.getElementById("modalOkBtn").onclick = () => {
                window.location.href = "index.html";
            };
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
    let price = state.carPrice;
    if (state.addons.ac) price += state.addonPrice;
    if (state.addons.pickup) price += state.addonPrice;
    state.totalPrice = price;

    const priceEls = document.querySelectorAll(".total-price");
    priceEls.forEach(el => {
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
    if (history.state?.training_days) return String(history.state.training_days);
    if (window.training_days) return String(window.training_days);
    if (sessionStorage.getItem("training_days")) return sessionStorage.getItem("training_days");
    if (localStorage.getItem("training_days")) return localStorage.getItem("training_days");

    const params = new URLSearchParams(window.location.search);
    if (params.has("training_days")) return params.get("training_days");

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

function validateBranchSection() {
    if (!state.branch) {
        alert("Please select a branch before proceeding.");
        return false;
    }
    return true;
}

function validateCarSection() {
    if (!state.car) {
        alert("Please select a car before proceeding.");
        return false;
    }
    return true;
}

/* =====================================================
   DATE VALIDATION
===================================================== */
function validateDateSection() {
    if (!startDateInput.value) {
        alert("Select start date");
        return false;
    }
    if (!state.duration) {
        alert("Select duration");
        return false;
    }
    if (state.selectedSlots.length !== requiredSlotCount()) {
        alert(`Please select ${requiredSlotCount()} time slots`);
        return false;
    }
    return true;
}

function validateLicenceSection() {
    if (!state.hasLicence) {
        alert("Please select whether you have a licence.");
        return false;
    }
    if (state.hasLicence === "yes") {
        const dlNo = document.getElementById("dlNumber").value.trim();
        const dlFrom = document.getElementById("dlFrom").value;
        const dlTo = document.getElementById("dlTo").value;

        if (!dlNo || !dlFrom || !dlTo) {
            alert("Please fill all licence details.");
            return false;
        }
    }
    return true;
}

function validateInstructorSection() {
    if (!state.instructor.knows) {
        alert("Please indicate if you know an instructor.");
        return false;
    }
    if (state.instructor.knows === "yes" && !state.instructor.name) {
        alert("Please select an instructor.");
        return false;
    }
    return true;
}

function validateAddonSection() {
    return true;
}


async function fetchBookedSlots(branch, car, date) {
    const res = await fetch("/api/bookings");
    const data = await res.json();

    if (!data.success) return [];

    // Filter by branch, car and date
    const bookings = data.bookings.filter(b => {
        if (!b.starting_from) return false;
        const start = new Date(b.starting_from);
        const end = new Date(start);
        end.setDate(start.getDate() + 29);

        const selectedTime = new Date(date).getTime();

        const status = (b.attendance_status || "").toLowerCase();
        if (!["active","pending"].includes(status)) return false;

        return b.branch === branch && b.car_name === car &&
               selectedTime >= start.getTime() && selectedTime <= end.getTime();
    });

    // Collect booked timeslots
    const slots = [];
    bookings.forEach(b => {
        ["allotted_time", "allotted_time2", "allotted_time3", "allotted_time4"].forEach(key => {
            if (b[key]) slots.push(b[key]);
        });
    });

    return slots;
}
