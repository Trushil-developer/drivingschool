/* ===============================
   REGISTER WIZARD – FULL VERSION
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

/* ---------- ERROR ---------- */
const showError = msg => {
  ui.error.textContent = msg;
  ui.error.classList.remove("hidden");
};
const clearError = () => ui.error.classList.add("hidden");

/* ---------- DATA STORAGE ---------- */
const wizardData = {}; 

function saveStepData() {
  const inputs = ui.body.querySelectorAll("input, select, textarea");

  inputs.forEach(input => {
    const key = input.name || input.id;

    // Only skip slots here, allowing 'branch' to be saved
    if (key === "training_slots") return;

    if (input.type === "radio") {
      if (input.checked) wizardData[key] = input.value;
    } 
    else if (input.type === "checkbox") {
      wizardData[key] = input.checked;
    } 
    else {
      wizardData[key] = input.value;
    }
  });
}


/* ---------- STEPS ---------- */
const steps = [
  {
    title: "Your Details",
    desc: "Enter your personal information",
    required: () => {
      const name = document.querySelector('input[name="customer_name"]')?.value.trim();
      const mobile = document.querySelector('input[name="mobile_no"]')?.value.trim();
      const email = document.querySelector('input[name="email"]')?.value.trim();
      const licence = wizardData.has_licence;

      if (!name) return "Please enter your full name.";
      if (!mobile) return "Please enter your mobile number.";
      if (!email) return "Please enter your email address.";
      if (!licence) return "Please tell us if you have a learner's or driver's licence.";

      return true;
    },
    render: () => `
      <input name="customer_name" placeholder="Full Name" required>
      <input name="mobile_no" placeholder="Mobile Number" required>
      <input name="email" placeholder="Email Address" required>

      <div class="form-group">
        <div class="section-title">Do you have a Learner's / Driver's Licence?</div>
        <div class="option-grid" id="licenceOptions">
          <label class="option">
            <input type="radio" name="has_licence" value="yes" hidden> Yes
          </label>
          <label class="option">
            <input type="radio" name="has_licence" value="no" hidden> No
          </label>
        </div>
      </div>
    `,
    onLoad: () => {
      const options = document.querySelectorAll('#licenceOptions .option');
      options.forEach(option => {
        const input = option.querySelector('input');
        if (wizardData.has_licence === input.value) {
          option.classList.add('active');
          input.checked = true;
        }
        option.addEventListener('click', () => {
          options.forEach(o => o.classList.remove('active'));
          input.checked = true;
          option.classList.add('active');
          wizardData.has_licence = input.value;
        });
      });
    }
  },
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
        <div class="section-title">Select service you're interested in</div>
        <select id="wizardCourseSelect" class="wizard-select">
          <option value="">Select Service</option>
        </select>
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
        <div class="section-title">Which car would you like to do?</div>
        <div id="wizardCars" class="option-grid"></div>
      </div>

      <div class="form-group hidden" id="priceSection">
        <div class="section-title price-title-row">
          <span>Your Price</span>
          <span class="price-note">(No payment required now. Pay during your first lesson.)</span>
        </div>
        <div class="price-box">₹ <strong id="finalPrice">5000</strong></div>
        <div class="cta-row">
          <button type="button" id="bookNowBtn" class="cta-primary cta-orange cta-main">Book Session <span class="cta-arrow">→</span></button>
          <button type="button" id="enquiryBtn" class="cta-secondary cta-blue cta-small">Enquiry Now</button>
        </div>
      </div>
    `,
    onLoad: () => {
      ui.back.style.display = "block";
      ui.next.classList.add("hidden");
      ui.submit.classList.add("hidden");

      mirrorOptions("#trainingDaysGroup", "#wizardTraining");

      document.getElementById("wizardTraining").addEventListener("click", () => {
        document.getElementById("carSection").classList.remove("hidden");
        waitForCars();

        if (wizardData.preferred_car) {
          const price = calculatePrice();
          if (price) {
            wizardData.price = price;
            document.getElementById("finalPrice").textContent = price;
            document.getElementById("priceSection").classList.remove("hidden");
          }
        }
      });

      document.getElementById("wizardCars").addEventListener("click", e => {
        if (!e.target.closest(".option")) return;

        const price = calculatePrice();
        if (!price) {
          alert("Price not available for selected car & training plan.");
          return;
        }

        wizardData.price = price;
        document.getElementById("finalPrice").textContent = price;
        document.getElementById("priceSection").classList.remove("hidden");
      });


      document.getElementById("bookNowBtn")?.addEventListener("click", () => {
        wizardData.intent = "book";
        currentStep++;
        loadStep();
      });

      document.getElementById("enquiryBtn")?.addEventListener("click", async () => {
        saveStepData();

        if (!wizardData.customer_name || !wizardData.mobile_no) {
          alert("Please complete your basic details first.");
          return;
        }

        const selectedBranch = (window.branchList || []).find(b => b.branch_name === wizardData.branch);
        const bId = selectedBranch ? selectedBranch.id : null;

        const enquiryPayload = {
          full_name: wizardData.customer_name,
          email: wizardData.email || "",
          phone: wizardData.mobile_no,
          branch_id: bId ? Number(bId) : null,
          course_id: Number(wizardData.wizardCourseSelect) || null,
          has_licence: wizardData.has_licence === "yes" ? "Yes" : "No",
          hear_about: wizardData.hear_about || null,
          training_slots: Number(wizardData.training_slots) || null,
          preferred_car: wizardData.preferred_car || null,
          message: "Enquiry from registration wizard"
        };

        console.log("SUBMITTING ENQUIRY:", enquiryPayload);

        const result = await window.enquiryService.submit(enquiryPayload);
        if (result.success) {
          alert("Thank you! Our team will contact you shortly.");
          resetWizard();
        } else {
          alert(result.error || "Unable to submit enquiry.");
        }
      });
    }
  },
  {
    title: "Instructor",
    desc: "Choose your instructor",
    required: () => {
      const selected = document.querySelector("#wizardInstructors .option.active");
      return selected ? true : "Please select an instructor.";
    },
    render: () => `<div id="wizardInstructors" class="option-grid"></div>`,
    onLoad: () => mirrorSelect("#instructorSelect", "#wizardInstructors")
  },
  {
    title: "Preferred Time",
    desc: "Select your daily training time",
    required: () => {
      const val = document.getElementById("allotted_time")?.value;
      return val ? true : "Please select a time for your training.";
    },
    render: () => `<input id="allotted_time" placeholder="Select time">`,
    onLoad: () => flatpickr("#allotted_time", {
      enableTime: true,
      noCalendar: true,
      dateFormat: "h:i K",
      minuteIncrement: 30,
      minTime: "06:00",
      maxTime: "22:00"
    })
  },
  {
    title: "Final Details",
    desc: "Complete your registration",
    required: () => {
      const accepted = document.getElementById("accept_notes")?.checked;
      return accepted ? true : "You must accept the rules to continue.";
    },
    render: () => `
      <input name="total_fees" placeholder="Total Fees">
      <input name="advance" placeholder="Advance Paid">
      <label>
        <input type="checkbox" id="accept_notes"> I accept rules
      </label>
    `
  }
];

/* ---------- MIRROR HELPERS ---------- */
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
    const saved = wizardData[key];

    if (input.checked || saved === input.value) {
      card.classList.add("active");
    }

    card.onclick = () => {
      if (input.type === "radio") {
        inputs.forEach(i => (i.checked = false));
        container.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
        input.checked = true;
        card.classList.add("active");
        
        // Handle special slot mapping or standard save
        if (input.name === "training_slots") {
            wizardData.training_slots = Number(input.value);
        } else {
            wizardData[key] = input.value;
        }
      } else {
        input.checked = !input.checked;
        card.classList.toggle("active");
        wizardData[key] = input.checked;
      }

      if (triggerChange) {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    container.appendChild(card);
  });
}

function mirrorSelect(selectId, targetId) {
  const select = document.querySelector(selectId);
  const target = document.querySelector(targetId);
  if (!target || !select) return;
  target.innerHTML = "";

  [...select.options].forEach(opt => {
    if (!opt.value) return;
    const card = document.createElement("div");
    card.className = "option";
    card.textContent = opt.text;

    if (wizardData[select.name || select.id] === opt.value) {
      card.classList.add("active");
      select.value = opt.value;
    }

    card.onclick = () => {
      select.value = opt.value;
      target.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
      card.classList.add("active");

      const key = select.id === "carSelect" ? "preferred_car" : (select.name || select.id);
      wizardData[key] = opt.value;

      // 🔥 recalc price if possible
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

/* ---------- NAVIGATION ---------- */
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

  const inputs = ui.body.querySelectorAll("input, select, textarea");
  inputs.forEach(input => {
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
  document.getElementById("mainForm")?.reset();
  currentStep = 0;
  loadStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

ui.next.onclick = () => {
  const valid = steps[currentStep].required();
  if (valid !== true) {
    showError(valid);
    return;
  }
  saveStepData();
  currentStep++;
  loadStep();
};

ui.back.onclick = () => {
  saveStepData();
  currentStep--;
  loadStep();
};


function calculatePrice() {
  const slots = Number(wizardData.training_slots);
  const carSelect = document.getElementById("carSelect");
  if (!slots || !carSelect) return null;

  const selectedOption = carSelect.options[carSelect.selectedIndex];
  if (!selectedOption) return null;

  let price = 0;

  if (slots === 15) {
    price = Number(selectedOption.dataset.price15 || 0);
  } 
  else if (slots === 21) {
    price = Number(selectedOption.dataset.price21 || 0);
  }

  return price > 0 ? price : null;
}


loadStep();