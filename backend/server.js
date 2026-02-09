
// require("dotenv").config({ path: "./payment.env" }); 
// console.log("KEY_ID:", process.env.RAZORPAY_KEY_ID);
// console.log("KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET);

// const express = require("express");
// const multer = require("multer");
// const mysql = require("mysql2/promise");
// const cors = require("cors");
// const fs = require("fs");
// const path = require("path");
// const pdfParse = require("pdf-parse");
// const crypto = require("crypto");
// const razorpay = require("./razorpay"); // ✅ Razorpay instance

// const app = express();

// /* ---------------- MIDDLEWARE ---------------- */
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// /* ---------------- ROOT TEST ---------------- */
// app.get("/", (req, res) => {
//   res.send("Backend running");
// });

// /* ---------------- UPLOAD DIR ---------------- */
// const uploadDir = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// /* ---------------- MYSQL ---------------- */
// const db = mysql.createPool({
//   host: "localhost",
//   user: "root",
//   password: "root",
//   database: "print_system",
// });

// /* ---------------- MULTER ---------------- */
// const storage = multer.diskStorage({
//   destination: uploadDir,
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "-" + file.originalname);
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype !== "application/pdf") {
//       return cb(new Error("Only PDF allowed"));
//     }
//     cb(null, true);
//   },
// });

// /* ---------------- HELPERS ---------------- */
// function generateOTP() {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// }

// function generateQrToken() {
//   return crypto.randomBytes(32).toString("hex");
// }

// /* =========================================================
//    1️⃣ UPLOAD JOB
// ========================================================= */
// app.post("/api/upload-job", upload.single("pdf"), async (req, res) => {
//   try {
//     const { shopId, color, copies, paperSize,printSide  } = req.body;

//     if (!req.file) return res.status(400).json({ error: "PDF required" });

//     const fileBuffer = fs.readFileSync(req.file.path);
//     const pdfData = await pdfParse(fileBuffer);
//     const totalPages = pdfData.numpages;

//     const jobId = "JOB_" + Date.now();

//     await db.query(
//   `INSERT INTO print_jobs
//    (job_id, shop_id, file_name, file_path, color, copies, paper_size, print_side, total_pages, status, otp_verified)
//    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', FALSE)`,
//   [
//     jobId,
//     shopId,
//     req.file.originalname,
//     req.file.path,
//     color,
//     copies,
//     paperSize,
//     printSide,
//     totalPages,
//   ]
// );


//     res.json({ success: true, jobId });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// /* =========================================================
//    2️⃣ CREATE PAYMENT (RAZORPAY)
// ========================================================= */
// app.post("/api/create-payment", async (req, res) => {
//   try {
//     const { jobId } = req.body;

//     const [rows] = await db.query(
//       `SELECT total_pages,copies, color,print_side  FROM print_jobs WHERE job_id = ?`,
//       [jobId]
//     );

//     if (!rows.length) {
//       return res.status(404).json({ error: "Job not found" });
//     }

//     const { total_pages, copies, color,print_side} = rows[0];
//     // Pricing logic
//     let ratePerPage;

//     if (color === "bw") {
//       ratePerPage = print_side === "duplex" ? 4 : 2;
//     } else {
//       ratePerPage = print_side === "duplex" ? 20 : 10;
//     }
//     //const ratePerPage = rows[0].color === "color" ? 10 : 2;

//     let chargeableUnits;

//     if (print_side === "duplex") {
//       const sheets = Math.ceil(total_pages / 2);
//       chargeableUnits = sheets * copies;
//     } else {
//       chargeableUnits = total_pages * copies;
//     }

//     const totalAmount = chargeableUnits * ratePerPage;
//     //const totalAmount= total_pages* copies * ratePerPage;

//     const amountInPaise = totalAmount * 100; 

//     const order = await razorpay.orders.create({
//       amount: amountInPaise,
//       currency: "INR",
//       receipt: jobId,
//     });

//     await db.query(
//       `UPDATE print_jobs SET amount = ?, payment_order_id = ? WHERE job_id = ?`,
//       [amountInPaise, order.id, jobId]
//     );

//     res.json({
//       orderId: order.id,
//       amount: amountInPaise,
//       key: process.env.RAZORPAY_KEY_ID,
//       //key: razorpay.key_id,
//     });
//   } catch (err) {
//     console.error("PAYMENT ERROR:", err);
//     res.status(500).json({ error: "Payment creation failed" });
//   }
// });

// /* =========================================================
//    3️⃣ VERIFY PAYMENT (RAZORPAY)
// ========================================================= */
// app.post("/api/verify-payment", async (req, res) => {

//   try {
//     console.log("VERIFY PAYMENT BODY:", req.body);
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//     } = req.body;

    

//      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({ error: "Missing payment fields" });
//     }

//    // const body = `${razorpay_order_id}|${razorpay_payment_id}`;
//     const body = razorpay_order_id + "|" + razorpay_payment_id;


//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body)
//       .digest("hex");
    
//       console.log("EXPECTED:", expectedSignature);
//     console.log("RECEIVED:", razorpay_signature);

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ error: "Invalid payment signature" });
//     }

//     // await db.query(
//     //   `UPDATE print_jobs
//     //    SET status = 'PAID', payment_id = ?
//     //    WHERE payment_order_id = ?`,
//     //   [razorpay_payment_id, razorpay_order_id]
//     // );

//     const [jobRows] = await db.query(
//   `SELECT job_id FROM print_jobs WHERE payment_order_id = ?`,
//   [razorpay_order_id]
// );

// if (!jobRows.length) {
//   return res.status(400).json({ error: "Job not found for this order" });
// }

// const jobId = jobRows[0].job_id;


//     // 2️⃣ Mark job as PAID
//     const [paidResult] = await db.query(
//   `UPDATE print_jobs
//    SET status = 'PAID', payment_id = ?
//    WHERE job_id = ?`,
//   [razorpay_payment_id, jobId]
// );

//     if (paidResult.affectedRows === 0) {
//       return res.status(400).json({ error: "Job not found" });
//     }

//     // 3️⃣ Generate OTP
//     const otp = generateOTP();
//     //    Generate Token
//     const qrToken = generateQrToken();
//     const expiry = new Date(Date.now() + 5 * 60 * 1000);

//     await db.query(
//       `UPDATE print_jobs
//        SET otp = ?, otp_expires_at = ?, qr_token=?, qr_expires_at=?
//        WHERE job_id = ?`,
//       [otp, expiry, qrToken, expiry,jobId]
//     );

//     res.json({ success: true, otp,qrToken });
//   } catch (err) {
//     console.error("VERIFY ERROR:", err);
//     console.log(err)
//     res.status(500).json({ error: "Payment verification failed" });
//   }
// });

// /* =========================================================
//    4️⃣ GENERATE OTP
// ========================================================= */
// // app.post("/api/generate-otp", async (req, res) => {
// //   const { jobId } = req.body;

// //   const otp = generateOTP();
// //   const expiry = new Date(Date.now() + 5 * 60 * 1000);

// //   const [result] = await db.query(
// //     `UPDATE print_jobs
// //      SET otp = ?, otp_expires_at = ?
// //      WHERE job_id = ? AND status = 'PAID'`,
// //     [otp, expiry, jobId]
// //   );

// //   if (result.affectedRows === 0) {
// //     return res.status(400).json({ error: "Job not paid or not found" });
// //   }

// //   res.json({ success: true, otp });
// // });

// /* =========================================================
//    5️⃣ VERIFY OTP
// ========================================================= */
// app.post("/api/verify-otp", async (req, res) => {
//   const { otp } = req.body;

//   const [rows] = await db.query(
//     `SELECT job_id, otp_expires_at
//      FROM print_jobs
//      WHERE otp = ?
//        AND status = 'PAID'
//        AND otp_verified = FALSE`,
//     [otp]
//   );

//   if (!rows.length) {
//     return res.status(400).json({ error: "Invalid or used OTP" });
//   }

//   if (new Date(rows[0].otp_expires_at) < new Date()) {
//     return res.status(400).json({ error: "OTP expired" });
//   }

//   await db.query(
//     `UPDATE print_jobs SET otp_verified = TRUE WHERE job_id = ?`,
//     [rows[0].job_id]
//   );

//   res.json({ success: true, jobId: rows[0].job_id });
// });


// //   VERIFY QR
// app.post("/api/verify-qr", async (req, res) => {
//   const { qrToken } = req.body;

//   const [rows] = await db.query(
//     `SELECT job_id FROM print_jobs
//      WHERE qr_token=? AND qr_expires_at > NOW()
//        AND status='PAID'`,
//     [qrToken]
//   );

//   if (!rows.length)
//     return res.status(400).json({ error: "Invalid QR" });

//   res.json({ jobId: rows[0].job_id });
// });

// /* =========================================================
//    6️⃣ KIOSK FETCH JOB BY OTP
// ========================================================= */
// app.get("/api/kiosk/job-by-otp/:otp", async (req, res) => {
//   const { otp } = req.params;

//   const [rows] = await db.query(
//     `SELECT job_id, file_path, color, copies, paper_size
//      FROM print_jobs
//      WHERE otp = ?
//        AND status = 'PAID'
//        AND otp_verified = TRUE`,
//     [otp]
//   );

//   if (!rows.length) {
//     return res.status(403).json({ error: "Job not unlocked or OTP invalid" });
//   }

//   res.json(rows[0]);
// });


// /* =========================================================
//    7️⃣ MARK PRINTED
// ========================================================= */
// app.post("/api/kiosk/mark-printed", async (req, res) => {
//   const { jobId } = req.body;

//   await db.query(
//     `UPDATE print_jobs SET status = 'PRINTED',qr_token=NULL WHERE job_id = ?`,
//     [jobId]
//   );

//   res.json({ success: true });
// });

// /* ---------------- START SERVER ---------------- */
// app.listen(5000, () => {
//   console.log("Server running on port 5000");
// });




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

  return units * rate * 100; // paise
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

  const amount = calculatePrice(job);

  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: jobId + "_" + Date.now(),
  });

  await db.query(
    `UPDATE print_jobs
     SET amount=?, payment_order_id=?, status='PAYING'
     WHERE job_id=?`,
    [amount, order.id, jobId]
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
app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // 1️⃣ Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }

    // 2️⃣ Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    // 3️⃣ Find job by order ID
    const [[job]] = await db.query(
      `SELECT job_id FROM print_jobs WHERE payment_order_id = ?`,
      [razorpay_order_id]
    );

    if (!job) {
      return res
        .status(400)
        .json({ error: "Job not found for this order" });
    }

    // 4️⃣ Generate OTP + QR
    const otp = generateOTP();
    const qr = generateQrToken();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    // 5️⃣ Mark job as PAID and attach OTP/QR
    await db.query(
      `UPDATE print_jobs
       SET status = 'PAID',
           payment_id = ?,
           otp = ?,
           otp_expires_at = ?,
           qr_token = ?,
           qr_expires_at = ?
       WHERE job_id = ?`,
      [razorpay_payment_id, otp, expiry, qr, expiry, job.job_id]
    );

    // 6️⃣ Return OTP & QR to frontend
    res.json({
      success: true,
      otp,
      qrToken: qr,
    });

  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    res.status(500).json({ error: "Payment verification failed" });
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

    const [rows] = await db.query(
      `
      SELECT *
      FROM print_jobs
      WHERE status = 'PAID'
        AND (
          (otp IS NOT NULL AND otp = ? AND otp_expires_at > ?)
          OR
          (qr_token IS NOT NULL AND qr_token = ? AND qr_expires_at > ?)
        )
      LIMIT 1
      `,
      [
        otp || null,
        now,
        qrToken || null,
        now
      ]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        error: "Invalid or expired OTP / QR"
      });
    }

    const job = rows[0];

    // Mark OTP as used (VERY IMPORTANT)
    await db.query(
      `
      UPDATE print_jobs
      SET otp_verified = 1
      WHERE job_id = ?
      `,
      [job.job_id]
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

    const [result] = await db.query(
      `
      UPDATE print_jobs
      SET status='PRINTED'
      WHERE job_id=?
      `,
      [jobId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("MARK PRINTED ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


/* ---------------- START ---------------- */
app.listen(5000, () => console.log("Server running on 5000"));

