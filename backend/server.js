const express = require("express");
const multer = require("multer");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const razorpay = require("./razorpay"); // ✅ Razorpay instance

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- ROOT TEST ---------------- */
app.get("/", (req, res) => {
  res.send("Backend running");
});

/* ---------------- UPLOAD DIR ---------------- */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

/* ---------------- MYSQL ---------------- */
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "print_system",
});

/* ---------------- MULTER ---------------- */
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF allowed"));
    }
    cb(null, true);
  },
});

/* ---------------- HELPERS ---------------- */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* =========================================================
   1️⃣ UPLOAD JOB
========================================================= */
app.post("/api/upload-job", upload.single("pdf"), async (req, res) => {
  try {
    const { shopId, color, copies, paperSize } = req.body;

    if (!req.file) return res.status(400).json({ error: "PDF required" });

    const jobId = "JOB_" + Date.now();

    await db.query(
      `INSERT INTO print_jobs
      (job_id, shop_id, file_name, file_path, color, copies, paper_size, status, otp_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', FALSE)`,
      [
        jobId,
        shopId,
        req.file.originalname,
        req.file.path,
        color,
        copies,
        paperSize,
      ]
    );

    res.json({ success: true, jobId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   2️⃣ CREATE PAYMENT (RAZORPAY)
========================================================= */
app.post("/api/create-payment", async (req, res) => {
  try {
    const { jobId } = req.body;

    const [rows] = await db.query(
      `SELECT copies, color FROM print_jobs WHERE job_id = ?`,
      [jobId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Pricing logic
    const pricePerPage = rows[0].color === "color" ? 10 : 3;
    const amount = rows[0].copies * pricePerPage * 100; // paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: jobId,
    });

    await db.query(
      `UPDATE print_jobs SET amount = ?, payment_order_id = ? WHERE job_id = ?`,
      [amount, order.id, jobId]
    );

    res.json({
      orderId: order.id,
      amount,
      key: razorpay.key_id,
    });
  } catch (err) {
    console.error("PAYMENT ERROR:", err);
    res.status(500).json({ error: "Payment creation failed" });
  }
});

/* =========================================================
   3️⃣ VERIFY PAYMENT (RAZORPAY)
========================================================= */
app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    await db.query(
      `UPDATE print_jobs
       SET status = 'PAID', payment_id = ?
       WHERE payment_order_id = ?`,
      [razorpay_payment_id, razorpay_order_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

/* =========================================================
   4️⃣ GENERATE OTP
========================================================= */
app.post("/api/generate-otp", async (req, res) => {
  const { jobId } = req.body;

  const otp = generateOTP();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  const [result] = await db.query(
    `UPDATE print_jobs
     SET otp = ?, otp_expires_at = ?
     WHERE job_id = ? AND status = 'PAID'`,
    [otp, expiry, jobId]
  );

  if (result.affectedRows === 0) {
    return res.status(400).json({ error: "Job not paid or not found" });
  }

  res.json({ success: true, otp });
});

/* =========================================================
   5️⃣ VERIFY OTP
========================================================= */
app.post("/api/verify-otp", async (req, res) => {
  const { otp } = req.body;

  const [rows] = await db.query(
    `SELECT job_id, otp_expires_at
     FROM print_jobs
     WHERE otp = ?
       AND status = 'PAID'
       AND otp_verified = FALSE`,
    [otp]
  );

  if (!rows.length) {
    return res.status(400).json({ error: "Invalid or used OTP" });
  }

  if (new Date(rows[0].otp_expires_at) < new Date()) {
    return res.status(400).json({ error: "OTP expired" });
  }

  await db.query(
    `UPDATE print_jobs SET otp_verified = TRUE WHERE job_id = ?`,
    [rows[0].job_id]
  );

  res.json({ success: true, jobId: rows[0].job_id });
});

/* =========================================================
   6️⃣ KIOSK FETCH JOB
========================================================= */
app.get("/api/kiosk/job/:jobId", async (req, res) => {
  const { jobId } = req.params;

  const [rows] = await db.query(
    `SELECT job_id, file_path, color, copies, paper_size
     FROM print_jobs
     WHERE job_id = ?
       AND status = 'PAID'
       AND otp_verified = TRUE`,
    [jobId]
  );

  if (!rows.length) {
    return res.status(403).json({ error: "Job not unlocked" });
  }

  res.json(rows[0]);
});

/* =========================================================
   7️⃣ MARK PRINTED
========================================================= */
app.post("/api/kiosk/mark-printed", async (req, res) => {
  const { jobId } = req.body;

  await db.query(
    `UPDATE print_jobs SET status = 'PRINTED' WHERE job_id = ?`,
    [jobId]
  );

  res.json({ success: true });
});

/* ---------------- START SERVER ---------------- */
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
