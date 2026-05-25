import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Helper to construct the system prompt based on user customization settings.
 */
function buildSystemPrompt(settings) {
  const {
    gradeLevel = "high",
    noteStyle = "standard",
    depth = "balanced",
    modules = {}
  } = settings;

  let prompt = `You are an expert curriculum designer and educator. Your task is to generate high-fidelity, custom-tailored study notes based on the curriculum sheet provided.
  
`;

  // 1. Grade Level
  const gradeMapping = {
    primary: "Explain concepts using simple language suitable for a primary school student (ages 6-10). Use very basic vocabulary, short sentences, and friendly analogies.",
    middle: "Explain concepts in clear, engaging, and easy-to-understand language suitable for a middle school student (ages 11-13).",
    high: "Explain concepts in structured, academic yet accessible language suitable for a high school student (ages 14-18).",
    college: "Explain concepts with academic rigor, formal terminology, and depth suitable for a college or university undergraduate.",
    professional: "Explain concepts using professional terminology, detailed specifications, and workplace-relevant contexts."
  };
  prompt += `**Target Audience**: ${gradeMapping[gradeLevel] || gradeMapping.high}\n\n`;

  // 2. Note Style
  const styleMapping = {
    standard: "Format the output as standard study notes using clear headings, structured bullet points, and bolded terms for readability.",
    chapter: "Format the output as a detailed textbook chapter. Write in thorough, in-depth paragraphs with structured subsections and smooth transitions.",
    qa: "Format the output as a Q&A study guide. Provide a series of clear questions followed by detailed, explanatory answers. You may also use tables.",
    dialogue: "Format the output as a Socratic dialogue between an encouraging, intelligent tutor ('Tutor') and a curious student ('Student') exploring this topic. Use natural conversational dialogue to explain the concepts.",
    lesson: "Format the output as a professional lesson plan. Include learning objectives, a chronological lecture outline, slide script outlines, and classroom discussion prompts.",
    cheat: "Format the output as an ultra-condensed cheat-sheet summary. Use tables, brief bullet points, and quick-reference lists for rapid review."
  };
  prompt += `**Writing Style & Format**: ${styleMapping[noteStyle] || styleMapping.standard}\n\n`;

  // 3. Depth
  const depthMapping = {
    conceptual: "Focus heavily on intuitive understanding and core ideas, avoiding complex formulas or deep technical jargon.",
    balanced: "Balance conceptual understanding with appropriate equations, terminology, and structural details.",
    technical: "Provide a highly technical, rigorous breakdown. Use formal formulas, math symbols, detailed steps, and specific terminology where appropriate."
  };
  prompt += `**Technical Depth**: ${depthMapping[depth] || depthMapping.balanced}\n\n`;

  // 4. Inclusions (Modules)
  prompt += `**Content Inclusions**:\n`;
  if (modules.vocabulary) {
    prompt += `- Include a 'Key Vocabulary & Glossary' section highlighting and defining important terms.\n`;
  }
  if (modules.analogies) {
    prompt += `- Incorporate clear, memorable analogies and real-world examples to explain abstract ideas.\n`;
  }
  if (modules.misconceptions) {
    prompt += `- Include a 'Common Misconceptions' section detailing frequent student errors and explaining the correct concepts.\n`;
  }
  if (modules.solvedProblems) {
    prompt += `- Provide step-by-step solved sample problems or worked examples showing applications of the topic.\n`;
  }
  if (modules.activities) {
    prompt += `- Add a 'Hands-On Activity / Project' section with a simple, safe experiment or activity to reinforce the concept.\n`;
  }
  if (modules.quiz) {
    prompt += `- Include a 'Review Quiz' section at the end containing 5 practice questions (multiple choice or short answer). Below the quiz, write a clear horizontal rule and a 'Answer Key & Explanations' section.\n`;
  }

  prompt += `\n**Markdown Rules**:
- Output only valid Markdown content.
- Use clean, semantic heading hierarchies (# for title, ## for main sections, ### for subsections).
- Make sure tables, bullet points, and code blocks render correctly.
- Do not include any meta-talk or introductory remarks (like "Sure, here are your notes..."). Start directly with the note content.`;

  return prompt;
}

/**
 * Generate notes from curriculum page text and image data.
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.modelName - 'gemini-1.5-flash' | 'gemini-1.5-pro'
 * @param {string} params.pageText - Extracted text of the selected pages
 * @param {string[]} params.pageImages - Array of base64 image strings (data URL or pure base64)
 * @param {object} params.settings - Customized parameters
 * @param {function} params.onProgress - Optional callback for steps
 */
export async function generateCurriculumNotes({
  apiKey,
  modelName = "gemini-1.5-flash",
  pageText,
  pageImages = [],
  settings,
  onProgress = () => {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is required.");
  }

  onProgress("Initializing Gemini client...");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemPrompt(settings)
  });

  onProgress("Preparing prompt materials...");
  const promptParts = [];

  // Add contextual prompts
  promptParts.push(
    `Below is the curriculum/syllabus information for the topic I want you to teach.
    
--- START OF CURRICULUM TEXT ---
${pageText || "No text could be extracted."}
--- END OF CURRICULUM TEXT ---`
  );

  // Parse images if available and add them to parts
  if (pageImages && pageImages.length > 0) {
    onProgress(`Attaching ${pageImages.length} page images for multimodal parsing...`);
    pageImages.forEach((imgData) => {
      // Remove data URL prefix if present
      let base64Data = imgData;
      let mimeType = "image/png";
      
      if (imgData.startsWith("data:")) {
        const matches = imgData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }
      
      promptParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    });
  }

  // Add final instructions and custom prompts
  let finalInstruction = "\nGenerate the student notes for the topics described in the provided curriculum page(s).";
  if (settings.customPrompt && settings.customPrompt.trim()) {
    finalInstruction += `\n\n**Additional Custom Instructions**: ${settings.customPrompt.trim()}`;
  }
  promptParts.push(finalInstruction);

  onProgress("Generating notes (this may take a few moments)...");
  
  try {
    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error("Empty response received from Gemini.");
    }
    
    onProgress("Notes successfully generated!");
    return text;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "Failed to generate notes. Check your API key and connection.");
  }
}

/**
 * Scan Table of Contents or introductory pages text to extract a structured JSON list of topics and page ranges.
 */
export async function extractTopicsFromText({ apiKey, modelName = "gemini-1.5-flash", tocText }) {
  if (!apiKey) {
    throw new Error("Gemini API key is required.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  // Guarantee JSON structure using responseMimeType
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `You are an expert syllabus indexer. Analyze the following text extracted from the table of contents or introductory pages of a curriculum document.
Identify all the main topics, units, chapters, or themes along with their starting page and ending page numbers.
Provide a short 1-sentence summary description of what is covered under each topic.

Provide the output as a JSON array of objects. Do not wrap it in markdown block tags. Output ONLY the raw JSON array.
Each object in the array must strictly have these fields:
- "title": (string) The unit/chapter/topic title (e.g., "Unit 1: Introduction to Mechanics")
- "startPage": (number) The page number where it begins (1-indexed based on document page number)
- "endPage": (number) The page number where it ends (1-indexed, if same as start page put the same number, make sure it is a valid integer)
- "description": (string) A one-sentence summary of the learning targets or topics.

Syllabus Text:
${tocText}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse JSON response from topic extraction:", text, err);
      // Fallback search inside the response if there was markdown wrapping or other issues
      const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Failed to parse Table of Contents JSON from Gemini.");
    }
  } catch (error) {
    console.error("Error extracting topics:", error);
    throw new Error(error.message || "Failed to scan topics. Verify your API credentials.");
  }
}

/**
 * Refine existing notes with user chat prompts.
 */
export async function refineCurriculumNotes({
  apiKey,
  modelName = "gemini-1.5-flash",
  originalNotes,
  userPrompt,
  curriculumContext,
  onProgress = () => {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is required.");
  }

  onProgress("Initializing Gemini client for refinement...");
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const systemInstruction = `You are an expert tutor and curriculum editor. Your task is to edit, refine, or update the existing student notes based on the user's instructions.
Always preserve the styling, structured headings, tables, and general markdown formatting of the notes unless asked to change them.
Integrate information accurately from the original curriculum text if relevant.
Do not include any introductory remarks like "Here is your updated notes". Return ONLY the modified, complete markdown notes content.`;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction
  });

  const prompt = `Here are the existing student notes:
--- START OF NOTES ---
${originalNotes}
--- END OF NOTES ---

Here is the curriculum context (original pages text) for reference:
--- START OF CURRICULUM CONTEXT ---
${curriculumContext}
--- END OF CURRICULUM CONTEXT ---

The user wants the following modifications/refinements:
"${userPrompt}"

Generate the complete updated student notes incorporating these refinements.`;

  onProgress("Processing your refinement request...");
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error("Empty response received during refinement.");
    }
    
    onProgress("Refinement complete!");
    return text;
  } catch (error) {
    console.error("Gemini Refinement Error:", error);
    throw new Error(error.message || "Failed to refine notes. Check your API key.");
  }
}

/**
 * Generate a comprehensive 20-question multiple choice quiz from study notes.
 */
export async function generateQuizFromNotes({
  apiKey,
  modelName = "gemini-1.5-flash",
  notesText,
  onProgress = () => {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is required.");
  }

  onProgress("Initializing Gemini client for quiz generation...");
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Guarantee JSON structure using responseMimeType
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `You are an expert curriculum designer and exam creator. Your task is to generate a comprehensive, standard multiple choice practice quiz based on the provided student study notes.
The quiz must contain exactly 20 multiple choice questions that thoroughly test all major concepts, terms, and details covered in the notes.

Each question should have:
- Clear, distinct, and unambiguous options (exactly 4 options).
- Only ONE correct option.
- The correct option must match exactly one of the options in the array.
- A concise, high-quality explanation of 1-2 sentences explaining why the correct answer is right and why the other options are incorrect.

Return the output as a single JSON object. Output ONLY the raw JSON. Do not include markdown code block formatting (like \`\`\`json).
The JSON object must strictly match this schema:
{
  "title": (string) A concise, descriptive title for the quiz (e.g. "Newtonian Physics & Mechanics Practice Quiz"),
  "questions": (array of objects) exactly 20 elements, where each object has these fields:
    - "question": (string) The clear question text.
    - "options": (array of 4 strings) The 4 distinct multiple choice answers.
    - "correctAnswer": (string) The exact string of the correct answer (must match one of the items in the "options" array exactly).
    - "explanation": (string) A brief explanation of the correct answer.
}

Study Notes Context:
--- START OF STUDY NOTES ---
${notesText}
--- END OF STUDY NOTES ---
`;

  onProgress("Synthesizing 20 comprehensive questions...");
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error("Empty response received from Gemini for quiz generation.");
    }
    
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse JSON response from quiz generation:", text, err);
      // Fallback search inside the response if there was markdown wrapping or other issues
      const match = text.match(/\{\s*"title"[\s\S]*\}\s*/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Failed to parse Quiz JSON from Gemini.");
    }
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error(error.message || "Failed to generate quiz. Verify your API credentials and note content.");
  }
}

