
// const axios = require("axios");
// const readline = require("readline");
// const { print } = require("pdf-to-printer");

// const API_BASE = "http://localhost:5000/api";

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// function ask(question) {
//   return new Promise((resolve) => rl.question(question, resolve));
// }

// const MAX_ATTEMPTS = 3;

// (async () => {
//   let attempts = 0;

//   while (attempts < MAX_ATTEMPTS) {
//     try {
//       /* ===============================
//          1️⃣ TAKE OTP FROM CUSTOMER
//       =============================== */
//       const otp = await ask("Enter OTP: ");

//       if (!otp || otp.length !== 6 || isNaN(otp)) {
//         console.log("OTP must be exactly 6 digits.\n");
//         attempts++;
//         continue;
//       }

//       /* ===============================
//          2️⃣ VERIFY OTP (UNLOCK JOB)
//       =============================== */
//       const verifyRes = await axios.post(`${API_BASE}/verify-otp`, { otp });
//       const jobId = verifyRes.data.jobId;

//       console.log("OTP verified. Job unlocked.");

//       /* ===============================
//          3️⃣ FETCH JOB DETAILS (BY JOB ID)
//       =============================== */
//      const jobRes = await axios.get(`${API_BASE}/kiosk/job-by-otp/${otp}`);
//     const job = jobRes.data;

//     console.log("Job details received:");
//     console.log(job);

//       /* ===============================
//          4️⃣ PRINT DOCUMENT (REAL PRINT)
//       =============================== */
//       console.log("Printing file:", job.file_path);

//       await print(job.file_path, {
//         copies: job.copies,
//         monochrome: job.color === "bw",
//         paperSize: job.paper_size,
//       });

//       console.log("Printing completed.");

//       /* ===============================
//          5️⃣ MARK JOB AS PRINTED
//       =============================== */
//       await axios.post(`${API_BASE}/kiosk/mark-printed`, { jobId });

//       console.log("Print completed. Thank you.");
//       rl.close();
//       return;

//     } catch (err) {
//       attempts++;

//       const msg =
//         err.response?.data?.error ||
//         err.message ||
//         "Invalid OTP";

//       console.log(`Error: ${msg}`);
//       console.log(`Attempts left: ${MAX_ATTEMPTS - attempts}\n`);

//       if (attempts >= MAX_ATTEMPTS) {
//         console.log(
//           "Maximum attempts reached. Please contact support."
//         );
//         rl.close();
//         return;
//       }
//     }
//   }
// })();

/**
 * ==========================================
 * PRINT KIOSK CLIENT
 * ==========================================
 * - Accepts OTP or QR input
 * - Unlocks print job
 * - Prints PDF
 * - Marks job as printed
 */

const axios = require("axios");
const readline = require("readline");
const { print } = require("pdf-to-printer");

/* ===============================
   CONFIG
=============================== */
const API_BASE = "http://localhost:5000/api";
const MAX_ATTEMPTS = 3;

/* ===============================
   CLI SETUP
=============================== */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

/* ===============================
   HELPERS
=============================== */
function isOtp(input) {
  return /^\d{6}$/.test(input);
}

function isQrToken(input) {
  return /^[a-f0-9]{64}$/i.test(input);
}

function parseInput(input) {
  input = input.trim();

  if (input.startsWith("PRINTJOB:")) {
    const token = input.replace("PRINTJOB:", "").trim();
    if (isQrToken(token)) {
      return { qrToken: token };
    }
  }

  if (isOtp(input)) {
    return { otp: input };
  }

  if (isQrToken(input)) {
    return { qrToken: input };
  }

  return null;
}

/* ===============================
   MAIN FLOW
=============================== */
(async () => {
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    try {
      const input = await ask(
        "Enter OTP or Scan QR (PRINTJOB:XXXXXX): "
      );

      const payload = parseInput(input);

      if (!payload) {
        console.log("Invalid OTP or QR format.\n");
        attempts++;
        continue;
      }

      /* ===============================
         UNLOCK JOB
      =============================== */
      const unlockRes = await axios.post(
        `${API_BASE}/kiosk/unlock`,
        payload
      );

      const job = unlockRes.data;

      console.log("Job unlocked successfully.");
      console.log("Job details:", job);

      /* ===============================
         PRINT
      =============================== */
      console.log("Printing:", job.filePath);

      await print(job.filePath, {
        copies: job.copies,
        monochrome: job.color === "bw",
        paperSize: job.paperSize,
      });

      /* ===============================
         MARK PRINTED
      =============================== */
      await axios.post(`${API_BASE}/kiosk/mark-printed`, {
        jobId: job.jobId,
      });

      console.log("Print completed successfully.");
      rl.close();
      return;

    } catch (err) {
      attempts++;

      const msg =
        err.response?.data?.error ||
        err.message ||
        "Unlock failed";

      console.log(`Error: ${msg}`);
      console.log(`Attempts left: ${MAX_ATTEMPTS - attempts}\n`);

      if (attempts >= MAX_ATTEMPTS) {
        console.log("Maximum attempts reached.");
        rl.close();
        return;
      }
    }
  }
})();
