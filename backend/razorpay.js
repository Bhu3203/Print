const Razorpay = require("razorpay");

module.exports = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_xxxxx",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "xxxxxx",
});
