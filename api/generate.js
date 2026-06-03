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
 * Reusable helper to invoke OpenAI-compatible endpoints using native fetch.
 */
async function callOpenAICompatible(baseUrl, modelName, apiKey, systemPrompt, promptParts, requireJson, provider) {
  const userContent = [];
  
  for (const part of promptParts) {
    if (typeof part === 'string') {
      userContent.push({ type: 'text', text: part });
    } else if (part.inlineData) {
      // DeepSeek and Llama models usually do not support images on standard chat completions
      const supportsImages = (provider === 'openai' || modelName.includes('gemini'));
      if (supportsImages) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          }
        });
      } else {
        userContent.push({
          type: 'text',
          text: `[Page Image Attached: MimeType=${part.inlineData.mimeType} (Visual parsing is not supported by the selected model "${modelName}")]`
        });
      }
    }
  }

  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: userContent }
    ]
  };

  if (requireJson) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response choices returned from the API.");
  }
  return data.choices[0].message.content;
}

/**
 * Reusable helper to invoke Anthropic endpoints.
 */
async function callAnthropic(modelName, apiKey, systemPrompt, promptParts) {
  const userContent = [];
  
  for (const part of promptParts) {
    if (typeof part === 'string') {
      userContent.push({ type: 'text', text: part });
    } else if (part.inlineData) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: part.inlineData.mimeType,
          data: part.inlineData.data
        }
      });
    }
  }

  const payload = {
    model: modelName,
    max_tokens: 4000,
    messages: [
      { role: 'user', content: userContent }
    ]
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  if (!data.content || data.content.length === 0) {
    throw new Error("No content returned from Anthropic.");
  }
  return data.content[0].text;
}

/**
 * Abstracted unified generate helper function dispatching to providers
 */
async function generateContent({ provider, modelName, apiKey, systemInstruction, promptParts, requireJson = false }) {
  if (provider === 'openai') {
    return await callOpenAICompatible('https://api.openai.com/v1', modelName, apiKey, systemInstruction, promptParts, requireJson, provider);
  } else if (provider === 'deepseek') {
    return await callOpenAICompatible('https://api.deepseek.com', modelName, apiKey, systemInstruction, promptParts, requireJson, provider);
  } else if (provider === 'openrouter') {
    return await callOpenAICompatible('https://openrouter.ai/api/v1', modelName, apiKey, systemInstruction, promptParts, requireJson, provider);
  } else if (provider === 'anthropic') {
    return await callAnthropic(modelName, apiKey, systemInstruction, promptParts);
  } else {
    // Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const config = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (requireJson) {
      config.generationConfig = { responseMimeType: "application/json" };
    }
    const model = genAI.getGenerativeModel({
      model: modelName,
      ...config
    });

    const result = await model.generateContent(promptParts);
    const response = await result.response;
    return response.text();
  }
}

/**
 * Node Vercel Serverless Function handler proxying AI calls
 */
export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { action, payload } = req.body;
  if (!action || !payload) {
    return res.status(400).json({ error: "Missing action or payload" });
  }

  const modelName = payload.modelName || "gemini-3.5-flash";

  // Determine provider and extract actual model identifier
  let provider = 'gemini';
  let actualModel = modelName;

  if (modelName.startsWith('openrouter/')) {
    provider = 'openrouter';
    actualModel = modelName.substring('openrouter/'.length);
  } else if (modelName.startsWith('deepseek-')) {
    provider = 'deepseek';
  } else if (modelName.startsWith('gpt-') || modelName.startsWith('o1-') || modelName.startsWith('o3-')) {
    provider = 'openai';
  } else if (modelName.startsWith('claude-')) {
    provider = 'anthropic';
  }

  // Retrieve API Key securely from Server Environment variables or client payload fallback
  let apiKey = '';
  if (provider === 'openrouter') {
    apiKey = process.env.OPENROUTER_API_KEY || payload.apiKey;
  } else if (provider === 'deepseek') {
    apiKey = process.env.DEEPSEEK_API_KEY || payload.apiKey;
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || payload.apiKey;
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || payload.apiKey;
  } else {
    apiKey = process.env.GEMINI_API_KEY || payload.apiKey;
  }

  if (!apiKey) {
    return res.status(401).json({ 
      error: `${provider.toUpperCase()} API key is required. Configure ${provider.toUpperCase()}_API_KEY environment variable on the server or provide it in your client credentials settings.` 
    });
  }

  try {
    if (action === "generateCurriculumNotes") {
      const { pageText, pageImages = [], settings } = payload;
      const promptParts = [];
      promptParts.push(
        `Below is the curriculum/syllabus information for the topic I want you to teach.
        
--- START OF CURRICULUM TEXT ---
${pageText || "No text could be extracted."}
--- END OF CURRICULUM TEXT ---`
      );

      if (pageImages && pageImages.length > 0) {
        pageImages.forEach((imgData) => {
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

      let finalInstruction = "\nGenerate the student notes for the topics described in the provided curriculum page(s).";
      if (settings.customPrompt && settings.customPrompt.trim()) {
        finalInstruction += `\n\n**Additional Custom Instructions**: ${settings.customPrompt.trim()}`;
      }
      promptParts.push(finalInstruction);

      const text = await generateContent({
        provider,
        modelName: actualModel,
        apiKey,
        systemInstruction: buildSystemPrompt(settings),
        promptParts
      });

      return res.status(200).json({ text });

    } else if (action === "extractTopicsFromText") {
      const { tocText } = payload;
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

      const text = await generateContent({
        provider,
        modelName: actualModel,
        apiKey,
        systemInstruction: "You are an expert syllabus indexer.",
        promptParts: [prompt],
        requireJson: true
      });

      let parsedData;
      try {
        parsedData = JSON.parse(text);
      } catch (err) {
        const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          parsedData = JSON.parse(match[0]);
        } else {
          throw new Error("Failed to parse JSON response from topic extraction.");
        }
      }

      return res.status(200).json(parsedData);

    } else if (action === "refineCurriculumNotes") {
      const { originalNotes, userPrompt, curriculumContext } = payload;
      const systemInstruction = `You are an expert tutor and curriculum editor. Your task is to edit, refine, or update the existing student notes based on the user's instructions.
Always preserve the styling, structured headings, tables, and general markdown formatting of the notes unless asked to change them.
Integrate information accurately from the original curriculum text if relevant.
Do not include any introductory remarks like "Here is your updated notes". Return ONLY the modified, complete markdown notes content.
For mathematical equations and formulas:
- Prefer clean Unicode characters and standard text formatting (e.g., x², H₂O, Δ, ×, ÷) for simpler formulas to ensure they print well and can be copy-pasted directly into Google Docs.
- Use standard LaTeX only for complex formulas (e.g., matrices, integrals, fractions), wrapping inline expressions in single dollar signs (e.g., $E = mc^2$) and blocks in double dollar signs (e.g., $$a^2 + b^2 = c^2$$) so they auto-render correctly.`;

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

      const text = await generateContent({
        provider,
        modelName: actualModel,
        apiKey,
        systemInstruction: systemInstruction,
        promptParts: [prompt]
      });

      return res.status(200).json({ text });

    } else if (action === "generateQuizFromNotes") {
      const { notesText, options = {} } = payload;
      const {
        numQuestions = 10,
        difficulty = "medium",
        questionType = "mixed",
        purpose = "quiz",
        customInstructions = ""
      } = options;

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

      const text = await generateContent({
        provider,
        modelName: actualModel,
        apiKey,
        systemInstruction: "You are an expert curriculum designer, university professor, and assessment developer.",
        promptParts: [prompt],
        requireJson: true
      });

      let parsedQuiz;
      try {
        parsedQuiz = JSON.parse(text);
      } catch (err) {
        const match = text.match(/\{\s*"title"[\s\S]*\}\s*/);
        if (match) {
          parsedQuiz = JSON.parse(match[0]);
        } else {
          throw new Error("Failed to parse Quiz JSON from Gemini.");
        }
      }

      return res.status(200).json(parsedQuiz);
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Error processing action ${action}:`, error);
    return res.status(500).json({ error: error.message || "Proxy processing failed." });
  }
}
