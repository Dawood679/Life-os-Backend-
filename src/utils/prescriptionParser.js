// // // const { GoogleGenAI } = require('@google/genai');
// // // const Tesseract = require('tesseract.js');
// // // const { extractTextFromPDF } = require('./pdfParser');
// // // const callGroq = require('../config/groq');

// // // const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// // // const SYSTEM_PROMPT = `You are LIFEOS AI — a high-accuracy medical prescription data parser.
// // // Analyze the provided prescription (text or image) and extract all medical information accurately.
// // // Extract:
// // // 1. doctorName: Doctor's name or clinic/hospital name if doctor name is not explicitly mentioned.
// // // 2. followUpDate: Date of the prescription or next follow-up appointment date (YYYY-MM-DD or readable string).
// // // 3. medicines: Array of all prescribed medicines with their exact name, dose/strength (e.g. 500mg, 20mg), and frequency/timing (e.g. 1-0-1, 1-1-1, 1-0-0, 0-0-1).
// // // 4. doctorAdvice: Array of lifestyle, diet, or general health rules and instructions mentioned under Advice or general instructions.

// // // Return ONLY a valid JSON object matching this schema:
// // // {
// // //   "doctorName": "string",
// // //   "followUpDate": "string",
// // //   "medicines": [
// // //     {
// // //       "name": "string",
// // //       "dosage": "string",
// // //       "frequency": "string"
// // //     }
// // //   ],
// // //   "doctorAdvice": [
// // //     {
// // //       "category": "exercise" | "diet_restriction" | "lifestyle" | "general",
// // //       "instruction": "string"
// // //     }
// // //   ]
// // // }`;

// // // // Primary vision parser using Gemini Flash
// // // const parseWithGeminiVision = async (buffer, mimeType) => {
// // //   const base64Data = buffer.toString('base64');
  
// // //   const contents = [
// // //     {
// // //       inlineData: {
// // //         mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg'),
// // //         data: base64Data
// // //       }
// // //     },
// // //     {
// // //       text: `${SYSTEM_PROMPT}\nExtract all medicines from the prescription table or list. Respond strictly in valid JSON format.`
// // //     }
// // //   ];

// // //   const response = await ai.models.generateContent({
// // //     model: 'gemini-2.5-flash',
// // //     contents,
// // //     config: {
// // //       responseMimeType: 'application/json',
// // //       temperature: 0.1
// // //     }
// // //   });

// // //   return JSON.parse(response.text);
// // // };

// // // // Fallback text parser using Tesseract / pdf-parse + Groq
// // // const parseWithGroqFallback = async (buffer, mimeType) => {
// // //   let rawText = '';
// // //   if (mimeType === 'application/pdf') {
// // //     const pdfRes = await extractTextFromPDF(buffer);
// // //     rawText = pdfRes.text;
// // //   } else {
// // //     const { data } = await Tesseract.recognize(buffer, 'eng');
// // //     rawText = data.text;
// // //   }

// // //   const prompt = `OCR Extracted Text from Prescription:\n${rawText}\nExtract all prescribed medicines and advice into the specified JSON format.`;
// // //   const groqRes = await callGroq(prompt, SYSTEM_PROMPT);
// // //   return { ...JSON.parse(groqRes), rawText };
// // // };

// // // // Main Hybrid Parser
// // // const parsePrescriptionHybrid = async (buffer, mimeType) => {
// // //   try {
// // //     const parsed = await parseWithGeminiVision(buffer, mimeType);
// // //     return {
// // //       rawText: 'Extracted via Vision AI',
// // //       doctorName: parsed.doctorName || 'Doctor',
// // //       followUpDate: parsed.followUpDate || '',
// // //       medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
// // //       doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
// // //     };
// // //   } catch (visionErr) {
// // //     console.error('Vision AI failed, switching to Fallback OCR + Groq:', visionErr.message);
// // //     const fallbackParsed = await parseWithGroqFallback(buffer, mimeType);
// // //     return {
// // //       rawText: fallbackParsed.rawText || '',
// // //       doctorName: fallbackParsed.doctorName || 'Doctor',
// // //       followUpDate: fallbackParsed.followUpDate || '',
// // //       medicines: Array.isArray(fallbackParsed.medicines) ? fallbackParsed.medicines : [],
// // //       doctorAdvice: Array.isArray(fallbackParsed.doctorAdvice) ? fallbackParsed.doctorAdvice : []
// // //     };
// // //   }
// // // };

// // // module.exports = {
// // //   parsePrescriptionHybrid
// // // };


// // const { GoogleGenAI } = require('@google/genai');
// // const { extractTextFromPDF } = require('./pdfParser');
// // const callGroq = require('../config/groq');

// // const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// // const SYSTEM_PROMPT = `You are LIFEOS AI — a high-accuracy medical prescription data parser.
// // Analyze the provided prescription (text or image) and extract medical information.

// // Extract:
// // 1. doctorName: Doctor's name or clinic/hospital name.
// // 2. followUpDate: Date of the prescription or next follow-up appointment date.
// // 3. primaryIllness: Identify the main disease, condition, or risk. Classify it as "chronic" (lifetime), "temporary" (short-term), or "historical_risk" (e.g., allergies, low blood count). Also, provide a 1-sentence summary.
// // 4. medicines: Array of prescribed medicines (name, dosage, frequency).
// // 5. doctorAdvice: Array of lifestyle/diet rules.

// // Return ONLY a valid JSON object matching this schema:
// // {
// //   "doctorName": "string",
// //   "followUpDate": "string",
// //   "primaryIllness": {
// //     "name": "string",
// //     "type": "chronic" | "temporary" | "historical_risk" | "unknown",
// //     "summary": "string"
// //   },
// //   "medicines": [{ "name": "string", "dosage": "string", "frequency": "string" }],
// //   "doctorAdvice": [{ "category": "exercise"| "diet_restriction"| "lifestyle"| "general", "instruction": "string" }]
// // }`;

// // // Fast & Low-Cost path: Digital PDF text via Groq
// // const parseTextWithGroq = async (rawText) => {
// //   const prompt = `Digital Prescription Content:\n${rawText}\nExtract all medicines, doctor name, and lifestyle rules into valid JSON.`;
// //   const groqRes = await callGroq(prompt, SYSTEM_PROMPT);
// //   return JSON.parse(groqRes);
// // };

// // // Vision path: Scanned Images / Photo Prescriptions via Gemini Flash
// // const parseWithGeminiVision = async (buffer, mimeType) => {
// //   const base64Data = buffer.toString('base64');
  
// //   const contents = [
// //     {
// //       inlineData: {
// //         mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg'),
// //         data: base64Data
// //       }
// //     },
// //     {
// //       text: `${SYSTEM_PROMPT}\nExtract all medicines and advice from the prescription. Respond strictly in valid JSON format.`
// //     }
// //   ];

// //   const response = await ai.models.generateContent({
// //     model: 'gemini-2.5-flash',
// //     contents,
// //     config: {
// //       responseMimeType: 'application/json',
// //       temperature: 0.1
// //     }
// //   });

// //   return JSON.parse(response.text);
// // };

// // // Smart Router
// // const parsePrescriptionHybrid = async (buffer, mimeType) => {
// //   // 1. Check if it is a PDF with readable digital text
// //   if (mimeType === 'application/pdf') {
// //     try {
// //       const pdfResult = await extractTextFromPDF(buffer);
// //       if (pdfResult.text && pdfResult.text.trim().length > 60) {
// //         console.log('Routing to Groq (Digital Text PDF)');
// //         const parsed = await parseTextWithGroq(pdfResult.text);
// //         return {
// //           rawText: pdfResult.text,
// //           doctorName: parsed.doctorName || 'Doctor',
// //           followUpDate: parsed.followUpDate || '',
// //           medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
// //           doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
// //         };
// //       }
// //     } catch {
// //       console.log('PDF has no text layer, falling back to Vision AI');
// //     }
// //   }

// //   // 2. Route images and scanned PDFs directly to Vision AI
// //   console.log('Routing to Gemini Vision AI (Image/Scanned Document)');
// //   const parsed = await parseWithGeminiVision(buffer, mimeType);

// //   return {
// //     rawText: 'Extracted via Vision AI',
// //     doctorName: parsed.doctorName || 'Doctor',
// //     followUpDate: parsed.followUpDate || '',
// //     medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
// //     doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
// //   };
// // };

// // module.exports = {
// //   parsePrescriptionHybrid
// // };


// const { GoogleGenAI } = require('@google/genai');
// const { extractTextFromPDF } = require('./pdfParser');
// const callGroq = require('../config/groq');

// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// const SYSTEM_PROMPT = `You are LIFEOS AI — a high-accuracy medical prescription data parser.
// Analyze the provided prescription (text or image) and extract medical information accurately.

// Extract:
// 1. doctorName: Doctor's name or clinic/hospital name.
// 2. prescriptionDate: The date the prescription was written (usually printed at the top, e.g., YYYY-MM-DD or DD/MM/YYYY).
// 3. followUpDate: The next follow-up appointment date (often handwritten at the bottom, e.g., 'Next Visit'). Leave empty if not found.
// 4. conditions: An array of all identified diagnoses, clinical abbreviations (e.g., TYPE2DM, HTN), or medical conditions found in the prescription. Classify each as "chronic", "temporary", "historical_risk", or "unknown", and provide a short summary for each.
// 5. medicines: Array of prescribed medicines with exact name, dosage/strength, and frequency/timing.
// 6. doctorAdvice: Array of lifestyle, diet, or general health rules and instructions mentioned under Advice.

// Return ONLY a valid JSON object matching this schema:
// {
//   "doctorName": "string",
//   "prescriptionDate": "string",
//   "followUpDate": "string",
//   "conditions": [
//     {
//       "name": "string",
//       "type": "chronic" | "temporary" | "historical_risk" | "unknown",
//       "summary": "string"
//     }
//   ],
//   "medicines": [
//     {
//       "name": "string",
//       "dosage": "string",
//       "frequency": "string"
//     }
//   ],
//   "doctorAdvice": [
//     {
//       "category": "exercise" | "diet_restriction" | "lifestyle" | "general",
//       "instruction": "string"
//     }
//   ]
// }`;

// // Fast & Low-Cost path: Digital PDF text via Groq
// const parseTextWithGroq = async (rawText) => {
//   const prompt = `Digital Prescription Content:\n${rawText}\nExtract all medicines, doctor name, dates, and health conditions into valid JSON.`;
//   const groqRes = await callGroq(prompt, SYSTEM_PROMPT);
//   return JSON.parse(groqRes);
// };

// // Vision path: Scanned Images / Photo Prescriptions via Gemini Flash
// const parseWithGeminiVision = async (buffer, mimeType) => {
//   const base64Data = buffer.toString('base64');
  
//   const contents = [
//     {
//       inlineData: {
//         mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg'),
//         data: base64Data
//       }
//     },
//     {
//       text: `${SYSTEM_PROMPT}\nExtract all details from the prescription image/document. Respond strictly in valid JSON format.`
//     }
//   ];

//   const response = await ai.models.generateContent({
//     model: 'gemini-2.5-flash',
//     contents,
//     config: {
//       responseMimeType: 'application/json',
//       temperature: 0.1
//     }
//   });

//   return JSON.parse(response.text);
// };

// // Smart Router
// const parsePrescriptionHybrid = async (buffer, mimeType) => {
//   // 1. Check if it is a PDF with readable digital text
//   if (mimeType === 'application/pdf') {
//     try {
//       const pdfResult = await extractTextFromPDF(buffer);
//       if (pdfResult.text && pdfResult.text.trim().length > 60) {
//         console.log('Routing to Groq (Digital Text PDF)');
//         const parsed = await parseTextWithGroq(pdfResult.text);
//         return {
//     rawText: 'Extracted via Vision AI',
//     doctorName: parsed.doctorName || 'Doctor',
//     prescriptionDate: parsed.prescriptionDate || '',
//     followUpDate: parsed.followUpDate || '',
//     conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
//     medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
//     doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
//   };
//       }
//     } catch {
//       console.log('PDF has no text layer, falling back to Vision AI');
//     }
//   }

//   // 2. Route images and scanned PDFs directly to Vision AI
//   console.log('Routing to Gemini Vision AI (Image/Scanned Document)');
//   const parsed = await parseWithGeminiVision(buffer, mimeType);

//   return {
//     rawText: 'Extracted via Vision AI',
//     doctorName: parsed.doctorName || 'Doctor',
//     prescriptionDate: parsed.prescriptionDate || '',
//     followUpDate: parsed.followUpDate || '',
//     primaryIllness: parsed.primaryIllness || { name: '', type: 'unknown', summary: '' },
//     medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
//     doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
//   };
// };

// module.exports = {
//   parsePrescriptionHybrid
// };

const { GoogleGenAI } = require('@google/genai');
const { extractTextFromPDF } = require('./pdfParser');
const callGroq = require('../config/groq');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are LIFEOS AI — a high-accuracy medical prescription data parser.
Analyze the provided prescription (text or image) and extract medical information accurately.

Extract:
1. doctorName: Doctor's name or clinic/hospital name.
2. prescriptionDate: The date the prescription was written (usually printed at the top, e.g., YYYY-MM-DD or DD/MM/YYYY).
3. followUpDate: The next follow-up appointment date (often handwritten at the bottom, e.g., 'Next Visit'). Leave empty if not found.
4. conditions: An array of all identified diagnoses, clinical abbreviations (e.g., TYPE2DM, HTN, DYSLIPIDEMIA, CAD), or medical conditions found in the prescription. Classify each as "chronic", "temporary", "historical_risk", or "unknown", and provide a short summary for each.
5. medicines: Array of prescribed medicines with exact name, dosage/strength, and frequency/timing.
6. doctorAdvice: Array of lifestyle, diet, or general health rules and instructions mentioned under Advice.

Return ONLY a valid JSON object matching this schema:
{
  "doctorName": "string",
  "prescriptionDate": "string",
  "followUpDate": "string",
  "conditions": [
    {
      "name": "string",
      "type": "chronic" | "temporary" | "historical_risk" | "unknown",
      "summary": "string"
    }
  ],
  "medicines": [
    {
      "name": "string",
      "dosage": "string",
      "frequency": "string"
    }
  ],
  "doctorAdvice": [
    {
      "category": "exercise" | "diet_restriction" | "lifestyle" | "general",
      "instruction": "string"
    }
  ]
}`;

// Fast & Low-Cost path: Digital PDF text via Groq
const parseTextWithGroq = async (rawText) => {
  const prompt = `Digital Prescription Content:\n${rawText}\nExtract all medicines, doctor name, dates, and health conditions into valid JSON.`;
  const groqRes = await callGroq(prompt, SYSTEM_PROMPT);
  return JSON.parse(groqRes);
};

// Vision path: Scanned Images / Photo Prescriptions via Gemini Flash
const parseWithGeminiVision = async (buffer, mimeType) => {
  const base64Data = buffer.toString('base64');
  
  const contents = [
    {
      inlineData: {
        mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg'),
        data: base64Data
      }
    },
    {
      text: `${SYSTEM_PROMPT}\nExtract all details from the prescription image/document. Respond strictly in valid JSON format.`
    }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  return JSON.parse(response.text);
};

// Smart Router
const parsePrescriptionHybrid = async (buffer, mimeType) => {
  // 1. Check if it is a PDF with readable digital text
  if (mimeType === 'application/pdf') {
    try {
      const pdfResult = await extractTextFromPDF(buffer);
      if (pdfResult.text && pdfResult.text.trim().length > 60) {
        console.log('Routing to Groq (Digital Text PDF)');
        const parsed = await parseTextWithGroq(pdfResult.text);
        return {
          rawText: pdfResult.text,
          doctorName: parsed.doctorName || 'Doctor',
          prescriptionDate: parsed.prescriptionDate || '',
          followUpDate: parsed.followUpDate || '',
          conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
          medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
          doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
        };
      }
    } catch {
      console.log('PDF has no text layer, falling back to Vision AI');
    }
  }

  // 2. Route images and scanned PDFs directly to Vision AI
  console.log('Routing to Gemini Vision AI (Image/Scanned Document)');
  const parsed = await parseWithGeminiVision(buffer, mimeType);

  return {
    rawText: 'Extracted via Vision AI',
    doctorName: parsed.doctorName || 'Doctor',
    prescriptionDate: parsed.prescriptionDate || '',
    followUpDate: parsed.followUpDate || '',
    conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
    medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
    doctorAdvice: Array.isArray(parsed.doctorAdvice) ? parsed.doctorAdvice : []
  };
};

module.exports = {
  parsePrescriptionHybrid
};