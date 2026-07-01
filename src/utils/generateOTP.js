const crypto = require('crypto');


const generateOTP = () => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = Date.now() + 10 * 60 * 1000;
  return { otp, otpExpires };
};

module.exports = generateOTP;