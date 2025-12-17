/* =====================================
   ENQUIRY SERVICE – SHARED (SAFE)
===================================== */

(function () {
  async function submitEnquiry(payload) {
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();

      // Backend returned HTML (crash / 500 / Express error page)
      if (text.startsWith("<")) {
        console.error("❌ API returned HTML instead of JSON:", text);
        throw new Error("Server error. Please try again later.");
      }

      const data = JSON.parse(text);

      if (!res.ok) {
        console.error("❌ API Error Response:", data);
        throw new Error(data.message || "Failed to submit enquiry");
      }

      return { success: true, data };

    } catch (error) {
      console.error("❌ Enquiry Service Error:", error);
      return {
        success: false,
        error: error.message || "Network error"
      };
    }
  }

  window.enquiryService = {
    submit: submitEnquiry
  };
})();
