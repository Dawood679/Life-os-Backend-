const fileUpload = require('express-fileupload');

/**
 * Route-level middleware (mount only on the resume upload route so it
 * doesn't interfere with your normal express.json() body parsing elsewhere).
 *
 * useTempFiles: false  -> keeps the file in memory as req.files.resume.data (Buffer)
 *                         so we never touch disk, and pdf-parse can read it directly.
 */
const resumeFileUpload = fileUpload({
  useTempFiles: false,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  abortOnLimit: true,
  responseOnLimit: 'Resume file is too large. Max size is 5MB.'
});

/**
 * Validates that a PDF was actually sent under the field name "resume".
 */
const validateResumeFile = (req, res, next) => {
  if (!req.files || !req.files.resume) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a resume file (field name: "resume")'
    });
  }

  const file = req.files.resume;

  if (file.mimetype !== 'application/pdf') {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are supported for resume upload'
    });
  }

  next();
};

module.exports = { resumeFileUpload, validateResumeFile };