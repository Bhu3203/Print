



import { useState } from "react";
import { useEffect } from "react";

import { QRCodeCanvas } from "qrcode.react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const API_BASE = "http://localhost:5000/api";

function PrintForm() {
  const [shop, setShop] = useState("");
  const [file, setFile] = useState(null);
  const [color, setColor] = useState("bw");
  const [copies, setCopies] = useState(1);
  const [printSide, setPrintSide] = useState("single");
  const [paperSize, setPaperSize] = useState("A4");

  const [jobId, setJobId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [otp, setOtp] = useState(null);
  const [qrToken, setQrToken] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ===============================
     FILE VALIDATION
  =============================== */
  const handleFileChange = (e) => {
    setError("");
    setSuccess("");

    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("PDF size must be less than 10MB.");
      return;
    }

    setFile(selectedFile);
  };

  const fetchSummary = async (id) => {
    const res = await fetch(`${API_BASE}/job-summary/${id}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
  };
  /* ===============================
     STEP 1️⃣ UPLOAD JOB
  =============================== */
  const handleUploadJob = async () => {
    setError("");
    setSuccess("");

    if (!shop || !file) {
      setError("Shop and PDF are required.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("shopId", shop);
    formData.append("color", color);
    formData.append("copies", copies);
    formData.append("paperSize", paperSize);
    formData.append("printSide", printSide);

    try {
      const res = await fetch(`${API_BASE}/upload-job`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setJobId(data.jobId);
      await fetchSummary(data.jobId);
      setSuccess(`Job created. Job ID: ${data.jobId}`);
    } catch (err) {
      setError(err.message || "Upload failed.");
    }
  };

  /* ===============================
     UPDATE JOB BEFORE PAYMENT
  =============================== */
  const updateJob = async () => {
    const res = await fetch(`${API_BASE}/job/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color, copies, paperSize, printSide }),
    });
    await fetchSummary(jobId);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  };

  /* ===============================
     STEP 2️⃣ PAYMENT + OTP
  =============================== */
  const startPayment = async () => {
    setError("");
    setSuccess("");

    try {
      await updateJob();

      const res = await fetch(`${API_BASE}/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const options = {
        key: data.key,
        amount: data.amount,
        currency: "INR",
        order_id: data.orderId,

        handler: async (response) => {
          try {
            const verifyRes = await fetch(
              `${API_BASE}/verify-payment`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              }
            );

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error);

            // ✅ SAFE ACCESS
            setOtp(verifyData.otp);
            setQrToken(verifyData.qrToken);

            console.log("OTP:", verifyData.otp);
            console.log("QR Token:", verifyData.qrToken);

            setSuccess("Payment successful. OTP generated.");
          } catch (err) {
            setError(err.message || "Payment verification failed.");
          }
        },

        theme: { color: "#16a34a" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || "Payment failed.");
    }
  };


  useEffect(() => {
    if (jobId && !otp) updateJob();
  }, [color, copies, printSide, paperSize]);
  /* ===============================
     UI
  =============================== */
  return (
  <div style={styles.page}>
    <div style={styles.card}>
      <h2 style={styles.title}>📄 Print Document</h2>

      {error && <div style={styles.alertError}>{error}</div>}
      {success && <div style={styles.alertSuccess}>{success}</div>}

      {/* SHOP */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Select Shop</label>
        <select
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          style={styles.input}
        >
          <option value="">-- Select Shop --</option>
          <option value="shop_1">Shop 1</option>
          <option value="shop_2">Shop 2</option>
        </select>
      </div>

      {/* FILE */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Upload PDF</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          style={styles.fileInput}
        />
      </div>

      {/* PRINT TYPE */}
      <div style={styles.row}>
        <div style={styles.half}>
          <label style={styles.label}>Print Type</label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={styles.input}
          >
            <option value="bw">Black & White</option>
            <option value="color">Color</option>
          </select>
        </div>

        <div style={styles.half}>
          <label style={styles.label}>Copies</label>
          <input
            type="number"
            min="1"
            max="50"
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
            style={styles.input}
          />
        </div>
      </div>

      {/* PRINT SIDE & PAPER */}
      <div style={styles.row}>
        <div style={styles.half}>
          <label style={styles.label}>Print Side</label>
          <select
            value={printSide}
            onChange={(e) => setPrintSide(e.target.value)}
            style={styles.input}
          >
            <option value="single">Single Side</option>
            <option value="duplex">Duplex</option>
          </select>
        </div>

        <div style={styles.half}>
          <label style={styles.label}>Paper Size</label>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            style={styles.input}
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        </div>
      </div>

      {/* CREATE JOB */}
      {!jobId && (
        <button style={styles.primaryButton} onClick={handleUploadJob}>
          Upload & Create Job
        </button>
      )}

      {/* SUMMARY */}
      {summary && (
        <div style={styles.summaryBox}>
          <h3 style={styles.summaryTitle}>🧾 Order Summary</h3>
          <p>Pages: {summary.totalPages}</p>
          <p>Copies: {summary.copies}</p>
          <p>Units: {summary.units}</p>
          <p>Rate: ₹{summary.rate}</p>
          <h2 style={styles.total}>Total: ₹{summary.totalAmount}</h2>
        </div>
      )}

      {/* PAYMENT */}
      {jobId && !otp && (
        <button style={styles.payButton} onClick={startPayment}>
          Pay & Generate OTP
        </button>
      )}

      {/* OTP + QR */}
      {otp && (
        <div style={styles.otpBox}>
          <h2 style={styles.otpText}>🔐 OTP: {otp}</h2>
          <p>Scan at Kiosk or Enter OTP</p>
          <div style={{ marginTop: 15 }}>
            <QRCodeCanvas value={qrToken} size={200} />
          </div>
        </div>
      )}
    </div>
  </div>
);

}

/* ===============================
   STYLES
=============================== */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f0f4f8, #e2e8f0)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 500,
    background: "#ffffff",
    padding: 30,
    borderRadius: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  },

  title: {
    marginBottom: 20,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 600,
  },

  formGroup: {
    marginBottom: 15,
  },

  row: {
    display: "flex",
    gap: 12,
    marginBottom: 15,
  },

  half: {
    flex: 1,
  },

  label: {
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 5,
    display: "block",
  },

  input: {
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 14,
  },

  fileInput: {
    marginTop: 5,
  },

  primaryButton: {
    marginTop: 10,
    width: "100%",
    padding: 12,
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
  },

  payButton: {
    marginTop: 15,
    width: "100%",
    padding: 12,
    backgroundColor: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
  },

  summaryBox: {
    marginTop: 20,
    padding: 15,
    background: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },

  summaryTitle: {
    marginBottom: 10,
  },

  total: {
    marginTop: 10,
    color: "#16a34a",
  },

  otpBox: {
    marginTop: 20,
    textAlign: "center",
    padding: 20,
    background: "#ecfdf5",
    borderRadius: 10,
  },

  otpText: {
    color: "#065f46",
  },

  alertError: {
    background: "#fee2e2",
    padding: 10,
    borderRadius: 6,
    color: "#b91c1c",
    marginBottom: 10,
  },

  alertSuccess: {
    background: "#dcfce7",
    padding: 10,
    borderRadius: 6,
    color: "#166534",
    marginBottom: 10,
  },
};


export default PrintForm;




// import { useState } from "react";

// const API_BASE = "http://localhost:5000/api";
// const MAX_FILE_SIZE = 10 * 1024 * 1024;

// export default function PrintForm() {
//   const [step, setStep] = useState(1);

//   const [shop, setShop] = useState("");
//   const [file, setFile] = useState(null);
//   const [color, setColor] = useState("bw");
//   const [copies, setCopies] = useState(1);
//   const [paperSize, setPaperSize] = useState("A4");

//   const [jobId, setJobId] = useState(null);
//   const [otp, setOtp] = useState(null);

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");

//   /* ===============================
//      FILE HANDLER
//   =============================== */
//   const handleFileChange = (e) => {
//     setError("");
//     const f = e.target.files[0];
//     if (!f) return;

//     if (f.type !== "application/pdf") {
//       setError("Only PDF files are allowed");
//       return;
//     }
//     if (f.size > MAX_FILE_SIZE) {
//       setError("PDF must be under 10MB");
//       return;
//     }

//     setFile(f);
//   };

//   /* ===============================
//      STEP 1 – CREATE JOB
//   =============================== */
//   const createJob = async () => {
//     if (!shop || !file) {
//       setError("Select shop and upload PDF");
//       return;
//     }

//     setLoading(true);
//     setError("");

//     const formData = new FormData();
//     formData.append("pdf", file);
//     formData.append("shopId", shop);
//     formData.append("color", color);
//     formData.append("copies", copies);
//     formData.append("paperSize", paperSize);

//     try {
//       const res = await fetch(`${API_BASE}/upload-job`, {
//         method: "POST",
//         body: formData,
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error);

//       setJobId(data.jobId);
//       setStep(2);
//       setSuccess("Job created successfully");
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ===============================
//      STEP 2 – PAYMENT
//   =============================== */
//   const startPayment = async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const res = await fetch(`${API_BASE}/create-payment`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ jobId }),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error);

//       const rzp = new window.Razorpay({
//         key: data.key,
//         amount: data.amount,
//         currency: "INR",
//         order_id: data.orderId,
//         theme: { color: "#16a34a" },

//         handler: async (response) => {
//           const verify = await fetch(`${API_BASE}/verify-payment`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//               jobId,
//               razorpay_payment_id: response.razorpay_payment_id,
//               razorpay_order_id: response.razorpay_order_id,
//               razorpay_signature: response.razorpay_signature,
//             }),
//           });

//           const verifyData = await verify.json();
//           if (!verify.ok) throw new Error(verifyData.error);

//           setOtp(verifyData.otp);
//           setStep(3);
//         },
//       });

//       rzp.open();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ===============================
//      UI
//   =============================== */
//   return (
//   <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
//     <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
      
//       {/* Header */}
//       <h2 className="text-xl font-bold text-center mb-4">QuickPrint</h2>

//       <StepIndicator step={step} />

//       {error && (
//         <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
//           {error}
//         </p>
//       )}

//       {success && (
//         <p className="mt-3 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
//           {success}
//         </p>
//       )}

//       {/* STEP 1 – UPLOAD */}
//       {step === 1 && (
//         <div className="mt-4 space-y-4">

//           {/* Shop */}
//           <div>
//             <label className="text-sm font-medium">Select Shop</label>
//             <select
//               value={shop}
//               onChange={(e) => setShop(e.target.value)}
//               className="w-full mt-1 p-2 border rounded-lg"
//             >
//               <option value="">Choose a shop</option>
//               <option value="shop_1">Shop 1</option>
//               <option value="shop_2">Shop 2</option>
//             </select>
//           </div>

//           {/* File Upload */}
//           <div>
//             <label className="text-sm font-medium">Upload PDF</label>
//             <label className="mt-2 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-green-600">
//               <span className="text-green-600 text-xl font-bold">＋</span>
//               <span className="text-sm text-gray-600 mt-1">
//                 {file ? file.name : "Add file"}
//               </span>
//               <input
//                 type="file"
//                 accept="application/pdf"
//                 onChange={handleFileChange}
//                 className="hidden"
//               />
//             </label>
//           </div>

//           {/* Print Type */}
//           <div>
//             <label className="text-sm font-medium">Print Type</label>
//             <div className="grid grid-cols-2 gap-3 mt-2">
//               <button
//                 onClick={() => setColor("bw")}
//                 className={`p-3 border rounded-xl ${
//                   color === "bw" ? "border-green-600" : ""
//                 }`}
//               >
//                 B/W
//               </button>
//               <button
//                 onClick={() => setColor("color")}
//                 className={`p-3 border rounded-xl ${
//                   color === "color" ? "border-green-600" : ""
//                 }`}
//               >
//                 Color
//               </button>
//             </div>
//           </div>

//           {/* Copies */}
//           <div>
//             <label className="text-sm font-medium">Number of Copies</label>
//             <div className="flex items-center gap-4 mt-2">
//               <button
//                 onClick={() => setCopies(Math.max(1, copies - 1))}
//                 className="px-3 py-1 bg-gray-200 rounded"
//               >
//                 −
//               </button>
//               <span className="font-semibold">{copies}</span>
//               <button
//                 onClick={() => setCopies(copies + 1)}
//                 className="px-3 py-1 bg-gray-200 rounded"
//               >
//                 +
//               </button>
//             </div>
//           </div>

//           {/* Paper Size */}
//           <div>
//             <label className="text-sm font-medium">Paper Size</label>
//             <select
//               value={paperSize}
//               onChange={(e) => setPaperSize(e.target.value)}
//               className="w-full mt-1 p-2 border rounded-lg"
//             >
//               <option value="A4">A4</option>
//               <option value="A3">A3</option>
//             </select>
//           </div>

//           {/* CTA */}
//           <button
//             disabled={loading}
//             onClick={createJob}
//             className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
//           >
//             {loading ? "Uploading..." : "Create Print Job"}
//           </button>
//         </div>
//       )}

//       {/* STEP 2 – PAYMENT */}
//       {step === 2 && (
//         <div className="mt-6 space-y-4 text-center">
//           <p className="text-sm text-gray-600">Job ID</p>
//           <p className="font-mono text-lg">{jobId}</p>

//           <button
//             disabled={loading}
//             onClick={startPayment}
//             className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
//           >
//             {loading ? "Processing..." : "Pay & Generate OTP"}
//           </button>
//         </div>
//       )}

//       {/* STEP 3 – OTP */}
//       {step === 3 && (
//         <div className="mt-6 text-center bg-green-50 p-6 rounded-xl">
//           <p className="text-sm text-gray-700">
//             Enter this OTP on the kiosk
//           </p>
//           <h1 className="text-3xl font-bold tracking-widest mt-2 text-green-700">
//             {otp}
//           </h1>
//         </div>
//       )}
//     </div>
//   </div>
// );
// }

// /* ===============================
//    STEP INDICATOR
// =============================== */
// function StepIndicator({ step }) {
//   return (
//     <div className="flex justify-between text-xs text-gray-500 mt-2">
//       <span className={step >= 1 ? "font-bold text-green-600" : ""}>
//         Upload
//       </span>
//       <span className={step >= 2 ? "font-bold text-green-600" : ""}>
//         Payment
//       </span>
//       <span className={step >= 3 ? "font-bold text-green-600" : ""}>
//         OTP
//       </span>
//     </div>
//   );
// }
