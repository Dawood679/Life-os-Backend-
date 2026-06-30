// const jwt = require('jsonwebtoken');

// const generateTokenAndSetCookie = (userId, res) => {
//   const token = jwt.sign(
//     { id: userId },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRE }
//   );

//   res.cookie('token', token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'strict',
//     maxAge: 7 * 24 * 60 * 60 * 1000
//   });

//   return token;
// };

// module.exports = generateTokenAndSetCookie;


const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};


const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };

  res.status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
};

module.exports = { generateToken, sendTokenResponse };