const { PDFParse } = require('pdf-parse');

/**
 * Extracts plain text from a PDF file buffer (in-memory, no disk write).
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<{ text: string, numPages: number }>}
 */
const extractTextFromPDF = async (buffer) => {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    const cleanedText = result.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error(
        'Could not extract readable text from this PDF. It may be a scanned image without a text layer.'
      );
    }

    return {
      text: cleanedText,
      numPages: result.total ?? result.numpages
    };
  } finally {
    await parser.destroy(); // always release parser resources, success or failure
  }
};

module.exports = { extractTextFromPDF };