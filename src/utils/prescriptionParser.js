const { GoogleGenAI } = require('@google/genai');
const { extractTextFromPDF } = require('./pdfParser');
const callGroq = require('../config/groq');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are LIFEOS AI — a high-accuracy medical prescription data parser.
Analyze the provided prescription (text or image) thoroughly and extract medical information accurately.

Extract:
1. doctorName: Doctor's name or clinic/hospital name.
2. prescriptionDate: The date the prescription was written.
3. followUpDate: The next follow-up appointment date. Leave empty if not found.
4. conditions: An array of all identified diagnoses, diseases, chief complaints (C/O), clinical findings, or symptoms found anywhere in the document. 
   CRITICAL RULE: You MUST scan the entire document meticulously, including handwritten notes in the margins, and text under abbreviations like 'Dx', 'C/O', 'CC', 'Prov. Diagnosis', or 'Symptoms'. If any disease or symptom is found, add it here. Classify each as "chronic", "temporary", "historical_risk", or "unknown", and provide a short summary.
5. medicines: Array of prescribed medicines with exact name, dosage/strength, and frequency/timing.
6. doctorAdvice: Array of lifestyle, diet, or general health rules and instructions mentioned under Advice.

Return ONLY a valid JSON object matching this strict schema:
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