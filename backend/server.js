

// require("dotenv").config({ path: "./payment.env" });

// const express = require("express");
// const multer = require("multer");
// const mysql = require("mysql2/promise");
// const cors = require("cors");
// const fs = require("fs");
// const path = require("path");
// const pdfParse = require("pdf-parse");
// const crypto = require("crypto");
// const Razorpay = require("razorpay");

// const app = express();

// /* ---------------- CONFIG ---------------- */
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// /* ---------------- MIDDLEWARE ---------------- */
// app.use(cors());
// app.use(express.json());

// /* ---------------- MYSQL ---------------- */
// const db = mysql.createPool({
//   host: "localhost",
//   user: "root",
//   password: "root",
//   database: "print_system",
// });

// /* ---------------- UPLOAD ---------------- */
// const uploadDir = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// const upload = multer({
//   dest: uploadDir,
//   fileFilter: (_, file, cb) =>
//     file.mimetype === "application/pdf"
//       ? cb(null, true)
//       : cb(new Error("Only PDF allowed")),
// });

// /* ---------------- HELPERS ---------------- */
// const generateOTP = () =>
//   Math.floor(100000 + Math.random() * 900000).toString();

// const generateQrToken = () =>
//   crypto.randomBytes(32).toString("hex");

// function calculatePrice(job) {
//   let rate;

//   if (job.color === "bw") {
//     rate = job.print_side === "duplex" ? 4 : 2;
//   } else {
//     rate = job.print_side === "duplex" ? 20 : 10;
//   }

//   const units =
//     job.print_side === "duplex"
//       ? Math.ceil(job.total_pages / 2) * job.copies
//       : job.total_pages * job.copies;

//   return units * rate * 100; // paise
// }

// /* =========================================================
//    1️⃣ UPLOAD JOB
// ========================================================= */
// app.post("/api/upload-job", upload.single("pdf"), async (req, res) => {
//   const { shopId, color, copies, paperSize, printSide } = req.body;

//   const pdf = await pdfParse(fs.readFileSync(req.file.path));
//   const jobId = "JOB_" + Date.now();

//   await db.query(
//     `INSERT INTO print_jobs
//      (job_id, shop_id, file_name, file_path, color, copies,
//       paper_size, print_side, total_pages, status)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`,
//     [
//       jobId,
//       shopId,
//       req.file.originalname,
//       req.file.path,
//       color,
//       copies,
//       paperSize,
//       printSide,
//       pdf.numpages,
//     ]
//   );

//   res.json({ jobId });
// });

// /* =========================================================
//    2️⃣ UPDATE JOB (RESET PAYMENT)
// ========================================================= */
// app.patch("/api/job/:jobId", async (req, res) => {
//   const { jobId } = req.params;
//   const { color, copies, paperSize, printSide } = req.body;

//   const [r] = await db.query(
//     `UPDATE print_jobs
//      SET color=?, copies=?, paper_size=?, print_side=?,
//          amount=NULL, payment_order_id=NULL, status='CREATED'
//      WHERE job_id=? AND status IN ('CREATED','PAYING')`,
//     [color, copies, paperSize, printSide, jobId]
//   );

//   if (!r.affectedRows)
//     return res.status(409).json({ error: "Job locked" });

//   res.json({ success: true });
// });

// /* =========================================================
//    3️⃣ CREATE PAYMENT
// ========================================================= */
// app.post("/api/create-payment", async (req, res) => {
//   const { jobId } = req.body;

//   const [[job]] = await db.query(
//     `SELECT * FROM print_jobs WHERE job_id=? AND status='CREATED'`,
//     [jobId]
//   );

//   if (!job)
//     return res.status(409).json({ error: "Finish or cancel current payment" });

//   const amount = calculatePrice(job);

//   const order = await razorpay.orders.create({
//     amount,
//     currency: "INR",
//     receipt: jobId + "_" + Date.now(),
//   });

//   await db.query(
//     `UPDATE print_jobs
//      SET amount=?, payment_order_id=?, status='PAYING'
//      WHERE job_id=?`,
//     [amount, order.id, jobId]
//   );

//   res.json({
//     key: process.env.RAZORPAY_KEY_ID,
//     amount,
//     orderId: order.id,
//   });
// });

// /* =========================================================
//    4️⃣ VERIFY PAYMENT (FINAL & FIXED)
// ========================================================= */
// app.post("/api/verify-payment", async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//     } = req.body;

//     // 1️⃣ Validate input
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({ error: "Missing payment fields" });
//     }

//     // 2️⃣ Verify Razorpay signature
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ error: "Invalid signature" });
//     }

//     // 3️⃣ Find job by order ID
//     const [[job]] = await db.query(
//       `SELECT job_id FROM print_jobs WHERE payment_order_id = ?`,
//       [razorpay_order_id]
//     );

//     if (!job) {
//       return res
//         .status(400)
//         .json({ error: "Job not found for this order" });
//     }

//     // 4️⃣ Generate OTP + QR
//     const otp = generateOTP();
//     const qr = generateQrToken();
//     const expiry = new Date(Date.now() + 5 * 60 * 1000);

//     // 5️⃣ Mark job as PAID and attach OTP/QR
//     await db.query(
//       `UPDATE print_jobs
//        SET status = 'PAID',
//            payment_id = ?,
//            otp = ?,
//            otp_expires_at = ?,
//            qr_token = ?,
//            qr_expires_at = ?
//        WHERE job_id = ?`,
//       [razorpay_payment_id, otp, expiry, qr, expiry, job.job_id]
//     );

//     // 6️⃣ Return OTP & QR to frontend
//     res.json({
//       success: true,
//       otp,
//       qrToken: qr,
//     });

//   } catch (err) {
//     console.error("VERIFY PAYMENT ERROR:", err);
//     res.status(500).json({ error: "Payment verification failed" });
//   }
// });


// /* =========================================================
//    5️⃣ KIOSK UNLOCK (OTP OR QR)
// ========================================================= */
// app.post("/api/kiosk/unlock", async (req, res) => {
//   try {
//     const { otp, qrToken } = req.body;

//     if (!otp && !qrToken) {
//       return res.status(400).json({ error: "OTP or QR required" });
//     }

//     const now = new Date();

//     const [rows] = await db.query(
//       `
//       SELECT *
//       FROM print_jobs
//       WHERE status = 'PAID'
//         AND (
//           (otp IS NOT NULL AND otp = ? AND otp_expires_at > ?)
//           OR
//           (qr_token IS NOT NULL AND qr_token = ? AND qr_expires_at > ?)
//         )
//       LIMIT 1
//       `,
//       [
//         otp || null,
//         now,
//         qrToken || null,
//         now
//       ]
//     );

//     if (!rows || rows.length === 0) {
//       return res.status(401).json({
//         error: "Invalid or expired OTP / QR"
//       });
//     }

//     const job = rows[0];

//     // Mark OTP as used (VERY IMPORTANT)
//     await db.query(
//       `
//       UPDATE print_jobs
//       SET otp_verified = 1
//       WHERE job_id = ?
//       `,
//       [job.job_id]
//     );

//     res.json({
//       jobId: job.job_id,
//       filePath: job.file_path,
//       copies: job.copies,
//       color: job.color,
//       paperSize: job.paper_size,
//       printSide: job.print_side
//     });

//   } catch (err) {
//     console.error("KIOSK UNLOCK ERROR:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });





// /* =========================================================
//    7️⃣ MARK PRINTED
// ========================================================= */
// app.post("/api/kiosk/mark-printed", async (req, res) => {
//   try {
//     const { jobId } = req.body;

//     if (!jobId) {
//       return res.status(400).json({ error: "Job ID required" });
//     }

//     const [result] = await db.query(
//       `
//       UPDATE print_jobs
//       SET status='PRINTED'
//       WHERE job_id=?
//       `,
//       [jobId]
//     );

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: "Job not found" });
//     }

//     res.json({ success: true });
//   } catch (err) {
//     console.error("MARK PRINTED ERROR:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });


// /* ---------------- START ---------------- */
// app.listen(5000, () => console.log("Server running on 5000"));





require("dotenv").config({ path: "./payment.env" });

const express = require("express");
const multer = require("multer");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const cron = require("node-cron");

const app = express();

/* ---------------- CONFIG ---------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());

/* ---------------- MYSQL ---------------- */
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "print_system",
});

/* ---------------- UPLOAD ---------------- */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({
  dest: uploadDir,
  fileFilter: (_, file, cb) =>
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Only PDF allowed")),
});

/* ---------------- HELPERS ---------------- */
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateQrToken = () =>
  crypto.randomBytes(32).toString("hex");

function calculatePrice(job) {
  let rate;

  if (job.color === "bw") {
    rate = job.print_side === "duplex" ? 4 : 2;
  } else {
    rate = job.print_side === "duplex" ? 20 : 10;
  }

  const units =
    job.print_side === "duplex"
      ? Math.ceil(job.total_pages / 2) * job.copies
      : job.total_pages * job.copies;

  return {
    units,
    rate,
    total: units * rate,
    paise: units * rate * 100,
  };
}

/* =========================================================
   1️⃣ UPLOAD JOB
========================================================= */
app.post("/api/upload-job", upload.single("pdf"), async (req, res) => {
  const { shopId, color, copies, paperSize, printSide } = req.body;

  const pdf = await pdfParse(fs.readFileSync(req.file.path));
  const jobId = "JOB_" + Date.now();

  await db.query(
    `INSERT INTO print_jobs
     (job_id, shop_id, file_name, file_path, color, copies,
      paper_size, print_side, total_pages, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`,
    [
      jobId,
      shopId,
      req.file.originalname,
      req.file.path,
      color,
      copies,
      paperSize,
      printSide,
      pdf.numpages,
    ]
  );

  res.json({ jobId });
});

/* =========================================================
   2️⃣ JOB SUMMARY (PRICE PREVIEW)
========================================================= */
app.get("/api/job-summary/:jobId", async (req, res) => {
  const { jobId } = req.params;

  const [[job]] = await db.query(
    `SELECT * FROM print_jobs WHERE job_id=?`,
    [jobId]
  );

  if (!job) return res.status(404).json({ error: "Job not found" });

  const price = calculatePrice(job);

  res.json({
    totalPages: job.total_pages,
    copies: job.copies,
    printSide: job.print_side,
    color: job.color,
    units: price.units,
    rate: price.rate,
    totalAmount: price.total,
  });
});
/* =========================================================
   2️⃣ UPDATE JOB (RESET PAYMENT)
========================================================= */
app.patch("/api/job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { color, copies, paperSize, printSide } = req.body;

  const [r] = await db.query(
    `UPDATE print_jobs
     SET color=?, copies=?, paper_size=?, print_side=?,
         amount=NULL, payment_order_id=NULL, status='CREATED'
     WHERE job_id=? AND status IN ('CREATED','PAYING')`,
    [color, copies, paperSize, printSide, jobId]
  );

  if (!r.affectedRows)
    return res.status(409).json({ error: "Job locked" });

  res.json({ success: true });
});

/* =========================================================
   3️⃣ CREATE PAYMENT
========================================================= */
app.post("/api/create-payment", async (req, res) => {
  const { jobId } = req.body;

  const [[job]] = await db.query(
    `SELECT * FROM print_jobs WHERE job_id=? AND status='CREATED'`,
    [jobId]
  );

  if (!job)
    return res.status(409).json({ error: "Finish or cancel current payment" });

  const price = calculatePrice(job);
  const amount= price.paise;

  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: jobId + "_" + Date.now(),
  });

  await db.query(
    `UPDATE print_jobs
     SET amount=?, payment_order_id=?, status='PAYING'
     WHERE job_id=?`,
    [price.total, order.id, jobId]
  );

  res.json({
    key: process.env.RAZORPAY_KEY_ID,
    amount,
    orderId: order.id,
  });
});

/* =========================================================
   4️⃣ VERIFY PAYMENT (FINAL & FIXED)
========================================================= */
// app.post("/api/verify-payment", async (req, res) => {
//   const connection = await db.getConnection();

//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//     } = req.body;

//     // 1️⃣ Validate input
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({ error: "Missing payment fields" });
//     }

//     // 2️⃣ Verify Razorpay signature
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ error: "Invalid signature" });
//     }

//     await connection.beginTransaction(); 

//     // 3️⃣ Find job by order ID
// //   const [[job]] = await connection.query(
// //   `SELECT job_id FROM print_jobs 
// //    WHERE payment_order_id = ? AND status = ?`,
// //   [razorpay_order_id, 'PAYING']
// // );
//     const [rows] = await connection.query(
//       `SELECT * FROM print_jobs
//        WHERE payment_order_id = ?
//        FOR UPDATE`,
//       [razorpay_order_id]
//     );

//     //if (!job) {
//     if(rows.length===0){
//       await connection.rollback();
//       return res
//         .status(400)
//         .json({ error: "Job not found for this order" });
//     }
//     const job = rows[0];


//      if (job.status !== "PAYING") {
//       await connection.rollback();
//       return res.status(409).json({
//         error: "Payment already processed or invalid state"
//       });
//     }


//     // 4️⃣ Generate OTP + QR
//     const otp = generateOTP();
//     const qr = generateQrToken();
//     const expiry = new Date(Date.now() + 5 * 60 * 1000);

//     // 5️⃣ Mark job as PAID and attach OTP/QR
//     await connection.query(
//       `UPDATE print_jobs
//        SET status = 'PAID',
//            payment_id = ?,
//            otp = ?,
//            otp_expires_at = ?,
//            qr_token = ?,
//            qr_expires_at = ?
//        WHERE job_id = ?`,
//       [razorpay_payment_id, otp, expiry, qr, expiry, job.job_id]
//     );

//      await connection.commit();

//     // 6️⃣ Return OTP & QR to frontend
//     res.json({
//       success: true,
//       otp,
//       qrToken: qr,
//     });

//   } catch (err) {
//     await connection.rollback();
//     console.error("VERIFY PAYMENT ERROR:", err);
//     res.status(500).json({ error: "Payment verification failed" });
//   } finally {
//     connection.release();
//   }
// });
app.post("/api/verify-payment", async (req, res) => {
  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.query(
      `SELECT * FROM print_jobs
       WHERE payment_order_id = ?
       FOR UPDATE`,
      [razorpay_order_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Job not found" });
    }

    const job = rows[0];

    if (job.status !== "PAYING") {
      await connection.rollback();
      return res.status(409).json({
        error: "Payment already processed or invalid state"
      });
    }

    const otp = generateOTP();
    const qr = generateQrToken();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    await connection.query(
      `UPDATE print_jobs
       SET status = 'PAID',
           payment_id = ?,
           otp = ?,
           otp_expires_at = ?,
           qr_token = ?,
           qr_expires_at = ?,
           otp_verified = 0
       WHERE id = ?`,
      [razorpay_payment_id, otp, expiry, qr, expiry, job.id]
    );

    await connection.commit();

    res.json({ success: true, otp, qrToken: qr });

  } catch (err) {
    if (transactionStarted) {
      await connection.rollback();
    }
    console.error("VERIFY PAYMENT ERROR:", err);
    res.status(500).json({ error: "Payment verification failed" });
  } finally {
    connection.release();
  }
});


/* =========================================================
   5️⃣ KIOSK UNLOCK (OTP OR QR)
========================================================= */
app.post("/api/kiosk/unlock", async (req, res) => {
  try {
    const { otp, qrToken } = req.body;

    if (!otp && !qrToken) {
      return res.status(400).json({ error: "OTP or QR required" });
    }

    const now = new Date();

    const [result] = await db.query(
      `
      UPDATE print_jobs
      SET status='PRINTING',
          otp_verified=1
      WHERE status='PAID'
        AND otp_verified=0
        AND (
          (otp IS NOT NULL AND otp=? AND otp_expires_at>?)
          OR
          (qr_token IS NOT NULL AND qr_token=? AND qr_expires_at>?)
        )
      `,
      [otp || null, now, qrToken || null, now]
    );

    if (result.affectedRows === 0) {
      return res.status(401).json({
        error: "Invalid, expired, or already used OTP / QR"
      });
    }

    const [[job]] = await db.query(
      `SELECT * FROM print_jobs 
       WHERE status='PRINTING'
       ORDER BY id DESC LIMIT 1`
    );

    res.json({
      jobId: job.job_id,
      filePath: job.file_path,
      copies: job.copies,
      color: job.color,
      paperSize: job.paper_size,
      printSide: job.print_side
    });

  } catch (err) {
    console.error("KIOSK UNLOCK ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});





/* =========================================================
   7️⃣ MARK PRINTED
========================================================= */
app.post("/api/kiosk/mark-printed", async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID required" });
    }

    const [[job]] = await db.query(
      `SELECT file_path, status 
       FROM print_jobs 
       WHERE job_id=?`,
      [jobId]
    );

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "PRINTING") {
      return res.status(400).json({ error: "Invalid job state" });
    }

    const [result] = await db.query(
       `
      UPDATE print_jobs
      SET status='PRINTED'
      WHERE job_id=? AND status='PRINTING'
      `,
      [jobId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "State transition failed"});
    }

    if (job.file_path) {
      fs.unlink(job.file_path, (err) => {
        if (err) {
          console.error("FILE DELETE ERROR:", err.message);
        } else {
          console.log("File deleted:", job.file_path);
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("MARK PRINTED ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
  MARK FAILED (Printer Error)
========================================================= */

app.post("/api/kiosk/mark-failed", async (req, res) => {
  try {
    const { jobId } = req.body;

    const [result] = await db.query(
      `
      UPDATE print_jobs
      SET status='FAILED'
      WHERE job_id=? AND status='PRINTING'
      `,
      [jobId]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ error: "Invalid state transition" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("MARK FAILED ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

  /* =========================================================
   CLEANUP OLD CREATED JOBS (30 MIN EXPIRY)
========================================================= */

cron.schedule("*/5 * * * *", async () => {
  console.log("Running cleanup cron...");

  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // 1️⃣ Find expired jobs
    const [jobs] = await db.query(
      `SELECT job_id, file_path 
       FROM print_jobs
       WHERE status='CREATED'
         AND created_at < ?`,
      [thirtyMinutesAgo]
    );

    if (jobs.length === 0) return;

    for (const job of jobs) {
      // 2️⃣ Delete file from disk
      if (job.file_path && fs.existsSync(job.file_path)) {
        fs.unlink(job.file_path, (err) => {
          if (err) {
            console.error("FILE DELETE ERROR:", err.message);
          }
        });
      }

      // 3️⃣ Delete DB row
      await db.query(
        `DELETE FROM print_jobs WHERE job_id=?`,
        [job.job_id]
      );

      console.log("Expired job deleted:", job.job_id);
    }

  } catch (err) {
    console.error("CRON CLEANUP ERROR:", err);
  }
});


/* ---------------- START ---------------- */
app.listen(5000, () => console.log("Server running on 5000"));

