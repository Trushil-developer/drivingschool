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
const wizardData = {}; // Stores all inputs for persistence

function saveStepData() {
  // save wizard body inputs
  const inputs = ui.body.querySelectorAll("input, select, textarea");
  inputs.forEach(input => {
    if (input.type === "radio") {
      if (input.checked) wizardData[input.name || input.id] = input.value;
    } else if (input.type === "checkbox") {
      wizardData[input.name || input.id] = input.checked;
    } else {
      wizardData[input.name || input.id] = input.value;
    }
  });


  const branchInputs = document.querySelectorAll("#branchCheckboxGroup input");
  branchInputs.forEach(input => {
    if (input.type === "radio" && input.checked) {
      wizardData[input.name || input.id] = input.value;
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

      if (!name) return "Please enter your full name.";
      if (!mobile) return "Please enter your mobile number.";
      if (!email) return "Please enter your email address.";
      return true;
    },
    render: () => `
      <input name="customer_name" placeholder="Full Name" required>
      <input name="mobile_no" placeholder="Mobile Number" required>
      <input name="email" placeholder="Email Address" required>
    `
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
        <div class="section-title">Select service you're intrestred</div>
        <select id="wizardCourseSelect" class="wizard-select">
          <option value="">Select Service</option>
        </select>
      </div>

      <div class="form-group">
        <div class="section-title">Select Your near by branch</div>
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
  desc: "Would you like to know pricing?",
  required: () => true, // no blocking here
  render: () => `
    <div class="form-group">
      <div class="section-title">How many slots do you want?</div>
      <div id="wizardTraining" class="option-grid"></div>
    </div>

    <div class="form-group hidden" id="carSection">
      <div class="section-title">Which car would you like to do?</div>
      <div id="wizardCars" class="option-grid"></div>
    </div>

    <div class="form-group hidden" id="priceSection">
      <div class="section-title">Your Price</div>

      <div class="price-box">
        ₹ <strong id="finalPrice">5000</strong>
      </div>

      <div class="cta-row">
        <button type="button" id="bookNowBtn" class="cta-primary">
          Would you like to book session?
        </button>

        <button type="button" id="enquiryBtn" class="cta-secondary">
          Enquiry Now
        </button>
      </div>
    </div>
  `,
  onLoad: () => {
    // hide wizard navigation
    ui.back.style.display = "none";
    ui.next.style.display = "none";
    ui.submit.classList.add("hidden");

    // load training days
    mirrorOptions("#trainingDaysGroup", "#wizardTraining");

    // show car section after training selection
    document.getElementById("wizardTraining").addEventListener("click", () => {
      document.getElementById("carSection").classList.remove("hidden");
      waitForCars();
    });

    // show price + CTA after car selection
    document.addEventListener("click", e => {
      if (e.target.closest("#wizardCars .option")) {
        document.getElementById("priceSection").classList.remove("hidden");

        wizardData.price = 5000;
        document.getElementById("finalPrice").textContent = "5000";
      }
    });

    // BOOK SESSION (primary CTA)
    document.getElementById("bookNowBtn")?.addEventListener("click", () => {
      wizardData.intent = "book";

      // You can:
      // 1️⃣ submit form
      // form.submit();

      // 2️⃣ OR go to booking step
      currentStep++;
      loadStep();
    });

    // ENQUIRY (secondary CTA)
    document.getElementById("enquiryBtn")?.addEventListener("click", () => {
      wizardData.intent = "enquiry";

      // Example: open modal / redirect / submit
      alert("Our team will contact you shortly.");
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
  container.innerHTML = "";

  inputs.forEach(input => {
    const card = document.createElement("div");
    card.className = "option";
    card.textContent = input.value;

    const saved = wizardData[input.name || input.id];

    // Restore active state
    if (input.type === "radio" && saved === input.value) {
      card.classList.add("active");
      input.checked = true;
    }
    if (input.type === "checkbox" && saved === true) {
      card.classList.add("active");
      input.checked = true;
    }

    card.onclick = () => {
      if (input.type === "radio") {
        // uncheck all radios
        inputs.forEach(i => i.checked = false);
        container.querySelectorAll(".option").forEach(o => o.classList.remove("active"));

        input.checked = true;
        card.classList.add("active");
        wizardData[input.name || input.id] = input.value;
      } else if (input.type === "checkbox") {
        input.checked = !input.checked;
        card.classList.toggle("active");
        wizardData[input.name || input.id] = input.checked;
      }

      if (triggerChange) input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    container.appendChild(card);
  });
}

function mirrorSelect(selectId, targetId) {
  const select = document.querySelector(selectId);
  const target = document.querySelector(targetId);
  target.innerHTML = "";

  [...select.options].forEach(opt => {
    if (!opt.value) return;
    const card = document.createElement("div");
    card.className = "option";
    card.textContent = opt.text;

    // Restore active if previously selected
    if (wizardData[select.name || select.id] === opt.value) {
      card.classList.add("active");
      select.value = opt.value;
    }

    card.onclick = () => {
      select.value = opt.value;
      target.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
      card.classList.add("active");
      wizardData[select.name || select.id] = opt.value;
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

  // Restore previous selection
  wizardSelect.value = hiddenSelect.value || wizardData["wizardCourseSelect"] || "";

  wizardSelect.addEventListener("change", () => {
    hiddenSelect.value = wizardSelect.value;
    wizardData["wizardCourseSelect"] = wizardSelect.value;
  });
}

function waitForCars() {
  const select = document.getElementById("carSelect");
  const debug = document.getElementById("carDebug");
  let attempts = 0;

  const timer = setInterval(() => {
    const cars = [...select.options].filter(o => o.value);
    attempts++;

    if (cars.length || attempts > 15) {
      clearInterval(timer);
      mirrorSelect("#carSelect", "#wizardCars");
      if (!cars.length) debug.textContent = "❌ No cars available";
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

if (step.hideNav) {
  ui.back.style.display = "none";
  ui.next.classList.add("hidden");
  ui.submit.classList.add("hidden");
} else {
  ui.back.style.display = currentStep === 0 ? "none" : "block";
  ui.next.classList.toggle("hidden", currentStep === steps.length - 1);
  ui.submit.classList.toggle("hidden", currentStep !== steps.length - 1);
}


  setTimeout(() => step.onLoad?.(), 100);

  // Restore all input values properly
  const inputs = ui.body.querySelectorAll("input, select, textarea");
  inputs.forEach(input => {
    const val = wizardData[input.name || input.id];
    if (val !== undefined) {
      if (input.type === "checkbox") {
        input.checked = val;
      } else if (input.type === "radio") {
        input.checked = input.value === val;
      } else {
        input.value = val;
      }
    }
  });
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

// Initial load
loadStep();
