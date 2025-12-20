/* ===============================
   REGISTER WIZARD – PRODUCTION READY
================================ */
let currentStep = 0;
const form = document.getElementById("mainForm");

/* ---------- ELEMENTS ---------- */
const ui = {
  title: document.getElementById("stepTitle"),
  desc: document.getElementById("stepDesc"),
  body: document.getElementById("stepBody"),
  progress: document.getElementById("progressBar"),
  badge: document.getElementById("stepBadge"),
  error: document.getElementById("formError"),
  back: document.getElementById("backBtn"),
  next: document.getElementById("nextBtn"),
  submit: document.getElementById("submitBtn")
};

/* ---------- ERROR HANDLING ---------- */
const showError = msg => {
  ui.error.textContent = msg;
  ui.error.classList.remove("hidden");
};
const clearError = () => ui.error.classList.add("hidden");

/* ---------- WIZARD DATA STORAGE ---------- */
const wizardData = {};

/* ---------- SAVE CURRENT STEP DATA ---------- */
function saveStepData() {
  const inputs = ui.body.querySelectorAll("input, select, textarea");
  inputs.forEach(input => {
    const key = input.name || input.id;
    if (!key) return;

    if (input.type === "radio") {
      if (input.checked) wizardData[key] = input.value;
    } else if (input.type === "checkbox") {
      wizardData[key] = input.checked;
    } else {
      wizardData[key] = input.value;
    }
  });
}

/* ---------- STEP DEFINITIONS ---------- */
const steps = [
  /* ---------------- STEP 1: Personal Details ---------------- */
  {
    title: "Your Details",
    desc: "Enter your personal information",
    required: () => {
      const getVal = s => document.querySelector(s)?.value.trim();
      if (!getVal('input[name="customer_name"]')) return "Please enter your full name.";
      if (!getVal('input[name="mobile_no"]')) return "Please enter your mobile number.";
      if (!getVal('input[name="email"]')) return "Please enter your email address.";
      if (!getVal('input[name="address"]')) return "Please enter your address.";
      if (!getVal('input[name="pincode"]')) return "Please enter your pincode.";
      if (!getVal('input[name="birth_date"]')) return "Please select your date of birth.";
      if (!getVal('select[name="sex"]')) return "Please select your sex.";
      return true;
    },
    render: () => `
      <input name="customer_name" placeholder="Full Name" class="wizard-input">
      <input name="mobile_no" placeholder="Mobile Number" class="wizard-input">
      <input name="email" placeholder="Email Address" class="wizard-input">
      <input name="address" placeholder="Address" class="wizard-input">
      <input name="pincode" placeholder="Pincode" class="wizard-input">
      <div class="form-group">
        <select name="sex" class="wizard-select">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <div class="section-title">Date of Birth</div>
        <input type="date" name="birth_date" class="wizard-input">
      </div>
    `
  },

  /* ---------------- STEP 2: Service & Branch ---------------- */
  {
    title: "Select Service & Branch",
    desc: "Choose your service and branch",
    required: () => {
      const course = document.getElementById("wizardCourseSelect")?.value;
      const branch = document.querySelector("#wizardBranch .option.active");
      if (!course) return "Please select a service.";
      if (!branch) return "Please select a branch.";
      return true;
    },
    render: () => `
      <div class="form-group">
        <div class="section-title">Select Service</div>
        <select id="wizardCourseSelect" class="wizard-select"></select>
      </div>
      <div class="form-group">
        <div class="section-title">Select Your nearby branch</div>
        <div id="wizardBranch" class="option-grid"></div>
      </div>
    `,
    onLoad: () => {
      syncCourseDropdown();
      mirrorOptions("#branchCheckboxGroup", "#wizardBranch", true);
    }
  },

  /* ---------------- STEP 3: Pricing & Plan ---------------- */
  {
    title: "Pricing",
    desc: "Choose your training plan",
    required: () => {
      const hear = document.getElementById("hearAboutSelect")?.value;
      if (!hear) return "Please tell us how you heard about us.";
      return true;
    },
    render: () => `
      <div class="form-group">
        <div class="section-title">Where did you hear about us?</div>
        <select id="hearAboutSelect" name="hear_about" class="wizard-select">
          <option value="">Select an option</option>
          <option value="google">Google Search / Website</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="friend">Friend / Referral</option>
          <option value="walkin">Walk-in / Near Branch</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <div class="section-title">How many slots do you want?</div>
        <div id="wizardTraining" class="option-grid"></div>
      </div>
      <div class="form-group hidden" id="carSection">
        <div class="section-title">Select Your Car</div>
        <div id="wizardCars" class="option-grid"></div>
      </div>
      <div class="form-group hidden" id="priceSection">
        <div class="section-title price-title-row">
          <span>Your Price</span>
          <span class="price-note">(No payment required now. Pay during your first lesson.)</span>
        </div>
        <div class="price-box">₹ <strong id="finalPrice">5000</strong></div>
        <div class="cta-row">
          <button type="button" id="bookNowBtn" class="cta-primary cta-orange cta-main">Book Session →</button>
          <button type="button" id="enquiryBtn" class="cta-secondary cta-blue cta-small">Enquiry Now</button>
        </div>
      </div>
    `,
    onLoad: () => {
      ui.back.style.display = "block";
      ui.next.classList.add("hidden");
      ui.submit.classList.add("hidden");

      mirrorOptions("#trainingDaysGroup", "#wizardTraining");

      const trainingContainer = document.getElementById("wizardTraining");
      trainingContainer.addEventListener("click", () => {
        document.getElementById("carSection").classList.remove("hidden");
        waitForCars();
      });

      document.getElementById("wizardCars").addEventListener("click", e => {
        if (!e.target.closest(".option")) return;
        const price = calculatePrice();
        if (!price) return alert("Price not available for selected car & training plan.");
        wizardData.price = price;
        document.getElementById("finalPrice").textContent = price;
        document.getElementById("priceSection").classList.remove("hidden");
      });

      // Book Now button
      document.getElementById("bookNowBtn")?.addEventListener("click", () => {
        wizardData.intent = "book";
        currentStep++;
        loadStep();
      });

      // Enquiry button
      document.getElementById("enquiryBtn")?.addEventListener("click", async () => {
        saveStepData();
        if (!wizardData.customer_name || !wizardData.mobile_no) {
          return alert("Please complete your basic details first.");
        }
        try {
          const selectedBranch = (window.branchList || []).find(b => b.branch_name === wizardData.branch);
          const payload = {
            full_name: wizardData.customer_name,
            email: wizardData.email || "",
            phone: wizardData.mobile_no,
            branch_id: selectedBranch?.id || null,
            course_id: Number(wizardData.wizardCourseSelect) || null,
            has_licence: wizardData.has_licence === "yes" ? "Yes" : "No",
            hear_about: wizardData.hear_about || null,
            training_slots: Number(wizardData.training_slots) || null,
            preferred_car: wizardData.preferred_car || null,
            message: "Enquiry from registration wizard"
          };
          const result = await window.enquiryService.submit(payload);
          if (result.success) alert("Thank you! Our team will contact you shortly.");
          else alert(result.error || "Unable to submit enquiry.");
          resetWizard();
        } catch (err) {
          console.error(err);
          alert("Something went wrong. Please try again.");
        }
      });
    }
  },

  /* ---------------- STEP 4: Booking Preferences ---------------- */
  {
    title: "Booking Preferences",
    desc: "Tell us when you'd like to start",
    required: () => {
      if (!wizardData.starting_from) return "Please select your preferred start date.";
      if (!wizardData.allotted_time) return "Please select your preferred time.";
      if (!wizardData.knows_instructor) return "Please tell us if you know your instructor.";
      if (wizardData.knows_instructor === "yes" && !wizardData.instructor_name) return "Please select your instructor.";
      return true;
    },
    render: () => `
      <div class="form-group">
        <div class="section-title">Preferred start date</div>
        <input id="starting_from" placeholder="Select date" class="wizard-input">
      </div>
      <div class="form-group">
        <div class="section-title">Preferred time</div>
        <input id="allotted_time" placeholder="Select time" class="wizard-input">
      </div>
      <div class="form-group">
        <div class="section-title">Do you know your instructor?</div>
        <div class="option-grid" id="knowInstructor">
          <div class="option" data-value="yes">Yes</div>
          <div class="option" data-value="no">No</div>
        </div>
      </div>
      <div class="form-group hidden" id="instructorSelectSection">
        <div class="section-title">Select Instructor</div>
        <div id="wizardInstructors" class="option-grid"></div>
      </div>
    `,
    onLoad: () => {
      flatpickr("#starting_from", {
        minDate: "today",
        dateFormat: "Y-m-d",
        defaultDate: wizardData.starting_from || null,
        onChange: d => wizardData.starting_from = d[0].toISOString().split("T")[0]
      });

      flatpickr("#allotted_time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K",
        minuteIncrement: 30,
        minTime: "06:00",
        maxTime: "22:00",
        defaultDate: wizardData.allotted_time || null,
        onChange: d => wizardData.allotted_time = d[0]
      });

      document.querySelectorAll("#knowInstructor .option").forEach(opt => {
        opt.onclick = () => {
          document.querySelectorAll("#knowInstructor .option").forEach(o => o.classList.remove("active"));
          opt.classList.add("active");
          wizardData.knows_instructor = opt.dataset.value;
          const section = document.getElementById("instructorSelectSection");
          if (opt.dataset.value === "yes") {
            section.classList.remove("hidden");
            mirrorSelect("#instructorSelect", "#wizardInstructors");
          } else {
            section.classList.add("hidden");
            wizardData.instructor_name = null;
          }
        };
      });

      if (wizardData.knows_instructor) {
        document.querySelector(`#knowInstructor .option[data-value="${wizardData.knows_instructor}"]`)?.click();
      }
    }
  },

  /* ---------------- STEP 5: License Information ---------------- */
  {
    title: "License Information",
    desc: "Complete your registration",
    required: () => {
      if (!wizardData.has_licence) return "Please tell us if you have a learner's or driver's licence.";
      if (wizardData.has_licence === "yes") {
        if (!wizardData.dl_no) return "Please enter your DL / Learner Licence number.";
        if (!wizardData.dl_from) return "Please select DL issue date.";
        if (!wizardData.dl_to) return "Please select DL expiry date.";
      }
      return true;
    },
    render: () => `
      <div class="form-group">
        <div class="section-title">Do you have a Learner's / Driver's Licence?</div>
        <div class="option-grid" id="licenceOptions">
          <div class="option" data-value="yes">Yes</div>
          <div class="option" data-value="no">No</div>
        </div>
      </div>
      <div class="form-group hidden" id="dlDetails">
        <input type="text" name="dl_no" placeholder="DL / Learner Licence Number" class="wizard-input">
        <div class="form-group">
          <div class="section-title">From</div>
          <input type="date" name="dl_from" class="wizard-input">
        </div>
        <div class="form-group">
          <div class="section-title">To</div>
          <input type="date" name="dl_to" class="wizard-input">
        </div>
      </div>
    `,
    onLoad: () => {
      const dlContainer = document.getElementById("dlDetails");
      document.querySelectorAll("#licenceOptions .option").forEach(opt => {
        opt.onclick = () => {
          document.querySelectorAll("#licenceOptions .option").forEach(o => o.classList.remove("active"));
          opt.classList.add("active");
          wizardData.has_licence = opt.dataset.value;

          if (opt.dataset.value === "yes") {
            dlContainer.classList.remove("hidden");
            dlContainer.querySelectorAll("input").forEach(input => {
              input.value = "";
              wizardData[input.name] = "";
            });
          } else {
            dlContainer.classList.add("hidden");
            ["dl_no", "dl_from", "dl_to"].forEach(key => wizardData[key] = "");
          }
        };
      });

      if (wizardData.has_licence) {
        const selectedOption = document.querySelector(`#licenceOptions .option[data-value="${wizardData.has_licence}"]`);
        if (selectedOption) selectedOption.click();
        ["dl_no", "dl_from", "dl_to"].forEach(key => {
          const input = dlContainer.querySelector(`input[name="${key}"]`);
          if (input) input.value = wizardData[key] || "";
        });
      }

      dlContainer.querySelectorAll("input").forEach(input => {
        const eventType = input.type === "date" ? "change" : "input";
        input.addEventListener(eventType, e => {
          wizardData[e.target.name] = e.target.value;
        });
      });
    }
  },

  /* ---------------- STEP 6: Final Details ---------------- */
  {
    title: "Final Details",
    desc: "Review your selections and accept terms to submit",
    required: () => {
      const accepted = document.getElementById("accept_notes")?.checked;
      return accepted ? true : "You must accept the rules to continue.";
    },
    render: () => {
      let reviewHtml = `<div class="review-section">`;
      for (const key in wizardData) {
        if (wizardData[key]) reviewHtml += `<div><strong>${key.replace(/_/g, " ")}:</strong> ${wizardData[key]}</div>`;
      }
      reviewHtml += `</div>`;

      const termsHtml = `
        <div class="terms-section">
          <h3>📌 TERMS & CONDITIONS</h3>
          <ul>
            <li>Course to be completed within 30 days</li>
            <li>15-day course to be completed within 20 days</li>
            <li>Fees must be paid in advance</li>
            <li>Fees are non-refundable</li>
            <li>AC Charges: Extra ₹1,000</li>
            <li>Pick-up & Drop Facility: Extra ₹1,000</li>
            <li>Only Learner & Instructor allowed in car</li>
            <li>Valid LMV Licence required during training</li>
          </ul>
          <label class="accept-rules">
            <input type="checkbox" id="accept_notes">
            <span>I accept rules</span>
          </label>
        </div>
      `;
      return reviewHtml + termsHtml;
    },
    onLoad: () => {
      const checkbox = document.getElementById("accept_notes");
      const submitBtn = document.getElementById("submitBtn");
      submitBtn.disabled = true;
      checkbox.addEventListener("change", () => submitBtn.disabled = !checkbox.checked);
    }
  }
];

/* ================================
   UTILITY & MIRROR FUNCTIONS
================================= */
function mirrorOptions(source, target, triggerChange = false) {
  const inputs = document.querySelectorAll(`${source} input`);
  const container = document.querySelector(target);
  if (!container) return;
  container.innerHTML = "";

  inputs.forEach(input => {
    const card = document.createElement("div");
    card.className = "option";
    card.textContent = input.dataset.label || input.value;

    const key = input.name || input.id;
    if (input.checked || wizardData[key] === input.value) card.classList.add("active");

    card.onclick = () => {
      if (input.type === "radio") {
        inputs.forEach(i => i.checked = false);
        container.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
        input.checked = true;
        card.classList.add("active");
        wizardData[key] = input.value;
      } else {
        input.checked = !input.checked;
        card.classList.toggle("active");
        wizardData[key] = input.checked;
      }
      if (triggerChange) input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    container.appendChild(card);
  });
}

function mirrorSelect(selectId, targetId) {
  const select = document.querySelector(selectId);
  const target = document.querySelector(targetId);
  if (!select || !target) return;
  target.innerHTML = "";

  [...select.options].forEach(opt => {
    if (!opt.value) return;
    const card = document.createElement("div");
    card.className = "option";
    card.textContent = opt.text;

    if (wizardData[select.name || select.id] === opt.value) card.classList.add("active");

    card.onclick = () => {
      select.value = opt.value;
      target.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
      card.classList.add("active");
      const key = select.id === "carSelect" ? "preferred_car" : (select.name || select.id);
      wizardData[key] = opt.value;
      if (select.id === "carSelect") {
        const price = calculatePrice();
        if (price) {
          wizardData.price = price;
          document.getElementById("finalPrice").textContent = price;
          document.getElementById("priceSection")?.classList.remove("hidden");
        }
      }
    };
    target.appendChild(card);
  });
}

function syncCourseDropdown() {
  const hiddenSelect = document.getElementById("courseSelect");
  const wizardSelect = document.getElementById("wizardCourseSelect");
  if (!hiddenSelect || !wizardSelect) return;

  wizardSelect.innerHTML = `<option value="">Select Service</option>`;
  [...hiddenSelect.options].forEach(opt => {
    if (!opt.value) return;
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.textContent;
    wizardSelect.appendChild(option);
  });

  wizardSelect.value = hiddenSelect.value || wizardData["wizardCourseSelect"] || "";
  wizardSelect.addEventListener("change", () => {
    hiddenSelect.value = wizardSelect.value;
    wizardData["wizardCourseSelect"] = wizardSelect.value;
  });
}

function waitForCars() {
  const select = document.getElementById("carSelect");
  if (!select) return;
  let attempts = 0;
  const timer = setInterval(() => {
    const cars = [...select.options].filter(o => o.value);
    attempts++;
    if (cars.length || attempts > 15) {
      clearInterval(timer);
      mirrorSelect("#carSelect", "#wizardCars");
    }
  }, 200);
}

function calculatePrice() {
  const slots = Number(wizardData.training_slots);
  const carSelect = document.getElementById("carSelect");
  if (!slots || !carSelect) return null;
  const selectedOption = carSelect.options[carSelect.selectedIndex];
  if (!selectedOption) return null;
  let price = 0;
  if (slots === 15) price = Number(selectedOption.dataset.price15 || 0);
  else if (slots === 21) price = Number(selectedOption.dataset.price21 || 0);
  return price > 0 ? price : null;
}

/* ================================
   NAVIGATION FUNCTIONS
================================= */
function loadStep() {
  clearError();
  const step = steps[currentStep];

  ui.title.textContent = step.title;
  ui.desc.textContent = step.desc;
  ui.body.innerHTML = step.render();
  ui.badge.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  ui.progress.style.width = ((currentStep + 1) / steps.length) * 100 + "%";

  ui.back.style.display = currentStep === 0 ? "none" : "block";
  ui.next.classList.toggle("hidden", currentStep === steps.length - 1);
  ui.submit.classList.toggle("hidden", currentStep !== steps.length - 1);

  setTimeout(() => step.onLoad?.(), 100);

  // Restore previous input values
  ui.body.querySelectorAll("input, select, textarea").forEach(input => {
    const val = wizardData[input.name || input.id];
    if (val !== undefined) {
      if (input.type === "checkbox") input.checked = val;
      else if (input.type === "radio") input.checked = input.value === val;
      else input.value = val;
    }
  });
}

function resetWizard() {
  Object.keys(wizardData).forEach(k => delete wizardData[k]);
  form?.reset();
  currentStep = 0;
  loadStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- BUTTON EVENTS ---------- */
ui.next.onclick = () => {
  const valid = steps[currentStep].required();
  if (valid !== true) return showError(valid);
  saveStepData();
  currentStep++;
  loadStep();
};

ui.back.onclick = () => {
  saveStepData();
  currentStep--;
  loadStep();
};

/* ---------- INITIALIZE WIZARD ---------- */
loadStep();