/**
 * Generate notes from curriculum page text and image data.
 * Calls the secure backend proxy /api/generate.
 */
export async function generateCurriculumNotes({
  apiKey,
  modelName = "gemini-1.5-flash",
  pageText,
  pageImages = [],
  settings,
  onProgress = () => {}
}) {
  onProgress("Connecting to learning models...");
  
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "generateCurriculumNotes",
        payload: {
          apiKey,
          modelName,
          pageText,
          pageImages,
          settings
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned status ${res.status}`);
    }

    const data = await res.json();
    onProgress("Study notes compiled!");
    return data.text;
  } catch (error) {
    console.error("Notes Generation Error:", error);
    throw new Error(error.message || "Failed to generate notes. Verify your connection or API credentials.");
  }
}

/**
 * Scan Table of Contents or introductory pages text to extract a structured JSON list of topics and page ranges.
 * Calls the secure backend proxy /api/generate.
 */
export async function extractTopicsFromText({ apiKey, modelName = "gemini-1.5-flash", tocText }) {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "extractTopicsFromText",
        payload: {
          apiKey,
          modelName,
          tocText
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Topics Extraction Error:", error);
    throw new Error(error.message || "Failed to scan topics. Verify API credentials.");
  }
}

/**
 * Refine existing notes with user chat prompts.
 * Calls the secure backend proxy /api/generate.
 */
export async function refineCurriculumNotes({
  apiKey,
  modelName = "gemini-1.5-flash",
  originalNotes,
  userPrompt,
  curriculumContext,
  onProgress = () => {}
}) {
  onProgress("Applying changes to notes...");
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "refineCurriculumNotes",
        payload: {
          apiKey,
          modelName,
          originalNotes,
          userPrompt,
          curriculumContext
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned status ${res.status}`);
    }

    const data = await res.json();
    onProgress("Notes refined successfully!");
    return data.text;
  } catch (error) {
    console.error("Refinement Error:", error);
    throw new Error(error.message || "Failed to refine notes.");
  }
}

/**
 * Generate a comprehensive assessment (quiz/exam/homework) from study notes.
 * Calls the secure backend proxy /api/generate.
 */
export async function generateQuizFromNotes({
  apiKey,
  modelName = "gemini-3.5-flash",
  notesText,
  options = {},
  onProgress = () => {}
}) {
  onProgress(`Generating assessment questions...`);
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "generateQuizFromNotes",
        payload: {
          apiKey,
          modelName,
          notesText,
          options
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Quiz Generation Error:", error);
    throw new Error(error.message || "Failed to generate quiz.");
  }
}
