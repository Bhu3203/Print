const axios = require("axios");
const readline = require("readline");

const API_BASE = "http://localhost:5000/api";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

(async () => {
  // try {
  //   /* ===============================
  //      1️⃣ TAKE OTP FROM CUSTOMER
  //   =============================== */
  //   const otp = await ask("Enter OTP: ");

  //   if (!otp || otp.length !== 6) {
  //     throw new Error("Invalid OTP format");
  //   }
let attempts = 0;
MAX_ATTEMPTS=3;
  while (attempts < MAX_ATTEMPTS) {
    try {
      const otp = await ask("Enter OTP: ");

      if (!otp || otp.length !== 6) {
        console.log("OTP must be 6 digits.");
        attempts++;
        continue;
      }

    /* ===============================
       2️⃣ VERIFY OTP (UNLOCK JOB)
    =============================== */
    const verifyRes = await axios.post(`${API_BASE}/verify-otp`, { otp });

    const jobId = verifyRes.data.jobId;
    console.log("OTP verified. Job unlocked.");

    /* ===============================
       3️⃣ FETCH JOB DETAILS
    =============================== */
    const jobRes = await axios.get(`${API_BASE}/kiosk/job-by-otp/${otp}`);
    const job = jobRes.data;

    console.log("Job details received:");
    console.log(job);

    /* ===============================
       4️⃣ PRINT (SIMULATED)
    =============================== */
    console.log("Printing file:", job.file_path);
    console.log(`Copies: ${job.copies}`);
    console.log(`Color mode: ${job.color}`);
    console.log(`Paper size: ${job.paper_size}`);

    // 🔜 REAL PRINTING (later)
    // exec(`lp -n ${job.copies} ${job.file_path}`);

    /* ===============================
       5️⃣ MARK JOB AS PRINTED
    =============================== */
    await axios.post(`${API_BASE}/kiosk/mark-printed`, { jobId });

      console.log("Print completed. Thank you.");
      rl.close();
      return;

    } catch (err) {
      attempts++;
      const msg = err.response?.data?.error || "Invalid OTP";

      console.log(`Error: ${msg}`);
      console.log(
        `Attempts left: ${MAX_ATTEMPTS - attempts}\n`
      );

      if (attempts >= MAX_ATTEMPTS) {
        console.log(
          "Maximum attempts reached. Please contact support."
        );
        rl.close();
        return;
      }
    }
  }
})();
