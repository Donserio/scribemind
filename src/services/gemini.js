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
- Do not include any meta-talk or introductory remarks (like "Sure, here are your notes..."). Start directly with the note content.
- **Mathematical Equations and Formulas**:
  - For simpler equations and expressions (e.g., using superscripts like x², subscripts like H₂O, Greek characters like Δ, π, θ, λ, and standard operators like ×, ÷, ±), prefer using standard Unicode symbols and clear plain-text formatting rather than LaTeX. This ensures they copy-paste beautifully to Google Docs and print clearly.
  - For complex mathematical equations (e.g., integrals, fractions, matrices, or multi-line derivations), use standard LaTeX. Wrap inline LaTeX equations in a single dollar sign (e.g., $E = mc^2$) and display equations on their own line in double dollar signs (e.g., $$F = G \\frac{m_1 m_2}{r^2}$$) so they render correctly in the browser preview.`;

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
Do not include any introductory remarks like "Here is your updated notes". Return ONLY the modified, complete markdown notes content.
For mathematical equations and formulas:
- Prefer clean Unicode characters and standard text formatting (e.g., x², H₂O, Δ, ×, ÷) for simpler formulas to ensure they print well and can be copy-pasted directly into Google Docs.
- Use standard LaTeX only for complex formulas (e.g., matrices, integrals, fractions), wrapping inline expressions in single dollar signs (e.g., $E = mc^2$) and blocks in double dollar signs (e.g., $$a^2 + b^2 = c^2$$) so they auto-render correctly.`;

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
 * Generate a comprehensive assessment (quiz/exam/homework) from study notes.
 */
export async function generateQuizFromNotes({
  apiKey,
  modelName = "gemini-3.5-flash",
  notesText,
  options = {},
  onProgress = () => {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is required.");
  }

  const {
    numQuestions = 10,
    difficulty = "medium",
    questionType = "mixed", // "mcq" | "theory" | "mixed"
    purpose = "quiz", // "quiz" | "exam" | "homework"
    customInstructions = ""
  } = options;

  onProgress(`Initializing Gemini client for ${purpose} generation...`);
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Guarantee JSON structure using responseMimeType
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" }
  });

  // Map settings to human-readable instructions
  const difficultyLabels = {
    easy: "Easy / Foundational (suitable for basic recall and simple comprehension)",
    medium: "Medium / Intermediate (requires understanding of application, analysis, and conceptual relationships)",
    hard: "Hard / Advanced (requires high-level analysis, synthesis, evaluation, and problem-solving)",
    "exam-level": "Exam-Level Challenge (rigorous, comprehensive, high-stakes testing standard)"
  };

  const purposeLabels = {
    quiz: "Practice Quiz (intended for low-stakes self-testing and checking understanding)",
    exam: "Exam Prep (intended for formal exam preparation, rigorous assessment, and testing under time pressure)",
    homework: "Homework Assignment (intended for deeper take-home conceptual reflection and problem-solving)"
  };

  let typeInstructions = "";
  if (questionType === "mcq") {
    typeInstructions = `All questions must be Multiple Choice Questions (MCQ). Each MCQ must have exactly 4 distinct options, only 1 correct answer, and an explanation of the correct choice. Set "type" to "mcq" for every item.`;
  } else if (questionType === "theory") {
    typeInstructions = `All questions must be Theory / Short-Answer / Essay questions. These should require the student to explain, derive, calculate, or describe concepts in their own words. Include a high-quality "sampleAnswer" and a clear "gradingRubric" for each. Do not include "options", "correctAnswer", or "explanation". Set "type" to "theory" for every item.`;
  } else {
    typeInstructions = `This is a Mixed-style assessment. Provide a balanced mix of Multiple Choice Questions (MCQs) and Theory / Short-Answer questions (approximately 60% MCQs, 40% Theory questions). For MCQs, set "type" to "mcq" and include options, correctAnswer, and explanation. For Theory questions, set "type" to "theory" and include sampleAnswer and gradingRubric.`;
  }

  const prompt = `You are an expert curriculum designer, university professor, and assessment developer. Your task is to generate a high-quality customized assessment based on the provided student study notes.

Assessment Parameters:
- Format/Purpose: ${purposeLabels[purpose] || purpose}
- Target Difficulty: ${difficultyLabels[difficulty] || difficulty}
- Question Types: ${typeInstructions}
- Length: Exactly ${numQuestions} questions in total.

${customInstructions ? `Special Instructions / Focus Topics:\n${customInstructions}\n` : ""}

Study Notes Context:
--- START OF STUDY NOTES ---
${notesText}
--- END OF STUDY NOTES ---

Instructions for generating questions:
1. Ensure all questions directly relate to the study notes provided.
2. The questions should thoroughly test concepts matching the requested difficulty: ${difficulty}.
3. The options for MCQ questions must be clear, plausible distractors, and have exactly one correct answer.
4. For Theory questions, the sample answer should be a model response (1-3 sentences or mathematical steps) that would receive full credit, and the grading rubric should explain the specific keywords, concepts, or steps required to earn points.
5. Provide a clear, cohesive title for the assessment that reflects the core subject matter.

Return the output as a single JSON object. Output ONLY the raw JSON.
The JSON object must strictly match this schema:
{
  "title": (string) A concise, descriptive title (e.g. "Advanced Electromagnetism Exam Prep"),
  "purpose": "${purpose}",
  "difficulty": "${difficulty}",
  "questions": (array of objects) containing exactly ${numQuestions} elements, where each object has these fields:
    - "type": (string) either "mcq" or "theory",
    - "question": (string) The clear question text.
    - "options": (array of 4 strings, ONLY for "mcq" type) The 4 distinct choices.
    - "correctAnswer": (string, ONLY for "mcq" type) The exact string of the correct answer (must match one of the items in "options" exactly).
    - "explanation": (string, ONLY for "mcq" type) A brief explanation of the correct answer.
    - "sampleAnswer": (string, ONLY for "theory" type) A high-quality model response.
    - "gradingRubric": (string, ONLY for "theory" type) Key details, steps, or words expected for full marks.
}
`;

  onProgress(`Synthesizing ${numQuestions} custom questions at ${difficulty} level...`);
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


