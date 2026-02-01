// import { useState } from "react";

// const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// function PrintForm() {
//   const [shop, setShop] = useState("");
//   const [file, setFile] = useState(null);
//   const [color, setColor] = useState("bw");
//   const [copies, setCopies] = useState(1);
//   const [paperSize, setPaperSize] = useState("A4");
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");
//   const [jobId, setJobId] = useState(null);
// const [otp, setOtp] = useState("");


//   /* ---------------- FILE VALIDATION ---------------- */
//   const handleFileChange = (e) => {
//     setError("");
//     setSuccess("");

//     const selectedFile = e.target.files[0];
//     if (!selectedFile) return;

//     if (selectedFile.type !== "application/pdf") {
//       setError("Only PDF files are allowed.");
//       return;
//     }

//     if (selectedFile.size > MAX_FILE_SIZE) {
//       setError("PDF size must be less than 10MB.");
//       return;
//     }

//     setFile(selectedFile);
//   };

//    /* ---------------- STEP 1: UPLOAD JOB ---------------- */
//   const handleSubmit = async () => {
//   setError("");
//   setSuccess("");

//   if (!shop) {
//     setError("Please select a shop.");
//     return;
//   }

//   if (!file) {
//     setError("Please upload a PDF file.");
//     return;
//   }

//    const formData = new FormData();
//   formData.append("pdf", file);
//   formData.append("shopId", shop);
//   formData.append("color", color);
//   formData.append("copies", copies);
//   formData.append("paperSize", paperSize);

//   try {
//     const res = await fetch("http://localhost:5000/api/upload-job", {
//       method: "POST",
//       body: formData,
//     });

//     const data = await res.json();
//     if (!res.ok) throw new Error();
//     setJobId(data.jobId);
//     setSuccess(`Job uploaded. Job ID: ${data.jobId}`);
//   } catch {
//     setError("Upload failed.");
//   }
// }
//   // if (copies < 1 || copies > 50) {
//   //   setError("Copies must be between 1 and 50.");
//   //   return;
//   // }

//   // try {
//   //   const response = await fetch("http://localhost:5000/api/create-job", {
//   //     method: "POST",
//   //     headers: {
//   //       "Content-Type": "application/json",
//   //     },
//   //     body: JSON.stringify({
//   //       shopId: shop,
//   //       color,
//   //       copies,
//   //       paperSize,
//   //     }),
//   //   });

//   //   if (!response.ok) {
//   //     throw new Error("Failed to create job");
//   //   }

//   //   const data = await response.json();

//   //   setSuccess(`Job created successfully. Job ID: ${data.jobId}`);
//   // } catch (err) {
//   //   console.error(err);
//   //   setError("Server error. Please try again.");
//   // }





//     // MOCK SUBMIT (NO BACKEND)
// //     const payload = {
// //       shop,
// //       fileName: file.name,
// //       color,
// //       copies,
// //       paperSize,
// //     };

// //     console.log("PRINT JOB PAYLOAD:", payload);

// //     setSuccess("Print job created successfully (mock).");
// //   };

//  /* ---------------- STEP 2 & 3: PAY + OTP ---------------- */
//   const payAndGenerateOtp = async () => {
//     setError("");
//     setSuccess("");

//     if (!jobId) {
//       setError("Job ID missing.");
//       return;
//     }

//     try {
//       // MARK PAID (mock payment)
//       const payRes = await fetch("http://localhost:5000/api/mark-paid", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ jobId }),
//       });

//       if (!payRes.ok) throw new Error("Payment failed");

//       // GENERATE OTP
//       const otpRes = await fetch("http://localhost:5000/api/generate-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ jobId }),
//       });

//       const otpData = await otpRes.json();
//       if (!otpRes.ok) throw new Error(otpData.error);

//       setOtp(otpData.otp);
//       setSuccess("Payment successful. OTP generated.");
//     } catch (err) {
//       setError("Payment or OTP generation failed.");
//     }
//   };

//   /* ---------------- UI ---------------- */
//   return (
//     <div style={styles.card}>
//       <h2 style={styles.title}>Print Document</h2>

//       {error && <p style={styles.error}>{error}</p>}
//       {success && <p style={styles.success}>{success}</p>}

//       <label style={styles.label}>Select Shop</label>
//       <select value={shop} onChange={(e) => setShop(e.target.value)} style={styles.input}>
//         <option value="">-- Select Shop --</option>
//         <option value="shop_1">Shop 1</option>
//         <option value="shop_2">Shop 2</option>
//       </select>

//       <label style={styles.label}>Upload PDF</label>
//       <input type="file" accept="application/pdf" onChange={handleFileChange} />

//       <label style={styles.label}>Print Type</label>
//       <select value={color} onChange={(e) => setColor(e.target.value)} style={styles.input}>
//         <option value="bw">Black & White</option>
//         <option value="color">Color</option>
//       </select>

//       <label style={styles.label}>Copies</label>
//       <input
//         type="number"
//         min="1"
//         max="50"
//         value={copies}
//         onChange={(e) => setCopies(Number(e.target.value))}
//         style={styles.input}
//       />

//       <label style={styles.label}>Paper Size</label>
//       <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)} style={styles.input}>
//         <option value="A4">A4</option>
//         <option value="A3">A3</option>
//       </select>

//       {!jobId && (
//         <button onClick={handleSubmit} style={styles.button}>
//           Upload & Create Job
//         </button>
//       )}

//       {jobId && !otp && (
//         <button onClick={payAndGenerateOtp} style={styles.button}>
//           Pay & Generate OTP (Mock)
//         </button>
//       )}

//       {otp && (
//         <div style={{ marginTop: "16px", fontWeight: "bold" }}>
//           OTP for Kiosk: <span style={{ color: "green" }}>{otp}</span>
//         </div>
//       )}
//     </div>
//   );
// }

// const styles = {
//   card: {
//     background: "#fff",
//     padding: "24px",
//     borderRadius: "8px",
//     maxWidth: "400px",
//     boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
//   },
//   title: { fontSize: "20px", marginBottom: "16px" },
//   label: { marginTop: "12px", display: "block" },
//   input: { width: "100%", padding: "8px", marginBottom: "8px" },
//   button: {
//     marginTop: "16px",
//     width: "100%",
//     padding: "10px",
//     backgroundColor: "#16a34a",
//     color: "#fff",
//     border: "none",
//     borderRadius: "4px",
//   },
//   error: { color: "red" },
//   success: { color: "green" },
// };

// export default PrintForm;



import { useState } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const API_BASE = "http://localhost:5000/api";

function PrintForm() {
  const [shop, setShop] = useState("");
  const [file, setFile] = useState(null);
  const [color, setColor] = useState("bw");
  const [copies, setCopies] = useState(1);
  const [paperSize, setPaperSize] = useState("A4");

  const [jobId, setJobId] = useState(null);
  const [otp, setOtp] = useState(null);

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

    try {
      const res = await fetch(`${API_BASE}/upload-job`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setJobId(data.jobId);
      setSuccess(`Job created successfully. Job ID: ${data.jobId}`);
    } catch (err) {
      setError(err.message || "Upload failed.");
    }
  };

  /* ===============================
     STEP 2️⃣ PAYMENT + OTP
  =============================== */
  const startPayment = async () => {
    setError("");
    setSuccess("");

    try {
      // 1️⃣ Create Razorpay order
      const res = await fetch(`${API_BASE}/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 2️⃣ Open Razorpay
      const options = {
        key: data.key,
        amount: data.amount,
        currency: "INR",
        order_id: data.orderId,

        handler: async (response) => {
          // 3️⃣ Verify payment
          const verifyRes = await fetch(`${API_BASE}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyData.error);

          // 4️⃣ OTP received
          setOtp(verifyData.otp);
          setSuccess("Payment successful. OTP generated.");
        },

        theme: { color: "#16a34a" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || "Payment failed.");
    }
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Print Document</h2>

      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      <label style={styles.label}>Select Shop</label>
      <select value={shop} onChange={(e) => setShop(e.target.value)} style={styles.input}>
        <option value="">-- Select Shop --</option>
        <option value="shop_1">Shop 1</option>
        <option value="shop_2">Shop 2</option>
      </select>

      <label style={styles.label}>Upload PDF</label>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />

      <label style={styles.label}>Print Type</label>
      <select value={color} onChange={(e) => setColor(e.target.value)} style={styles.input}>
        <option value="bw">Black & White</option>
        <option value="color">Color</option>
      </select>

      <label style={styles.label}>Copies</label>
      <input
        type="number"
        min="1"
        max="50"
        value={copies}
        onChange={(e) => setCopies(Number(e.target.value))}
        style={styles.input}
      />

      <label style={styles.label}>Paper Size</label>
      <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)} style={styles.input}>
        <option value="A4">A4</option>
        <option value="A3">A3</option>
      </select>

      {!jobId && (
        <button onClick={handleUploadJob} style={styles.button}>
          Upload & Create Job
        </button>
      )}

      {jobId && !otp && (
        <button onClick={startPayment} style={styles.button}>
          Pay & Generate OTP
        </button>
      )}

      {otp && (
        <div style={{ marginTop: "16px", fontWeight: "bold" }}>
          OTP for Kiosk: <span style={{ color: "green" }}>{otp}</span>
        </div>
      )}
    </div>
  );
}

/* ===============================
   STYLES
=============================== */
const styles = {
  card: {
    background: "#fff",
    padding: "24px",
    borderRadius: "8px",
    maxWidth: "400px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  title: { fontSize: "20px", marginBottom: "16px" },
  label: { marginTop: "12px", display: "block" },
  input: { width: "100%", padding: "8px", marginBottom: "8px" },
  button: {
    marginTop: "16px",
    width: "100%",
    padding: "10px",
    backgroundColor: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
  },
  error: { color: "red" },
  success: { color: "green" },
};

export default PrintForm;

