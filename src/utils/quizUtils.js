/**
 * Generate Google Apps Script code to create a Google Form quiz or exam.
 */
export function generateGoogleFormsAppsScript(quiz) {
  const safeTitle = (quiz.title || "Practice Assessment").replace(/'/g, "\\'");
  const purpose = quiz.purpose || "quiz";
  const isQuizMode = purpose === "quiz";
  
  let script = `/**
 * Google Apps Script to automatically generate a Google Form for:
 * "${quiz.title || "Custom Assessment"}"
 *
 * How to use:
 * 1. Open Google Drive (drive.google.com).
 * 2. Click "New" > "More" > "Google Apps Script" (or visit script.google.com).
 * 3. Delete any default code and paste this script.
 * 4. Click the "Save" icon (or Ctrl+S).
 * 5. Select the "createFormQuiz" function in the toolbar and click "Run".
 * 6. Grant the necessary permissions when prompted.
 * 7. Open Google Drive to access your newly created Google Form!
 */

function createFormQuiz() {
  var form = FormApp.create('${safeTitle}');
  form.setIsQuiz(${isQuizMode ? 'true' : 'false'});
  
  if (${isQuizMode ? 'true' : 'false'}) {
    form.setConfirmationMessage('Thank you for completing the quiz! Your score has been recorded.');
  } else {
    form.setConfirmationMessage('Your exam responses have been submitted successfully.');
  }
  
  // Student Details
  form.addSectionHeaderItem().setTitle('Student Information');
  form.addTextItem().setTitle('Full Name').setRequired(true);
  form.addTextItem().setTitle('Class / Section').setRequired(true);
  form.addTextItem().setTitle('School / Institution').setRequired(true);
  
  // Separate Identification from Assessment Questions
  form.addPageBreakItem().setTitle('${isQuizMode ? "Practice Quiz" : "Exam Questions"}');
  
  var item, choice;
  
`;

  if (quiz && quiz.questions) {
    quiz.questions.forEach((q, index) => {
      const safeQuestion = (q.question || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
      
      script += `  // Question ${index + 1}\n`;
      if (q.type === 'theory') {
        const safeSampleAnswer = (q.sampleAnswer || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
        const safeRubric = (q.gradingRubric || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
        
        script += `  item = form.addParagraphTextItem();\n`;
        script += `  item.setTitle('${index + 1}. ${safeQuestion}');\n`;
        if (isQuizMode) {
          script += `  item.setPoints(5);\n`; // Set point weight for theory
        }
        
        if (safeSampleAnswer || safeRubric) {
          let helpText = "";
          if (safeSampleAnswer) helpText += `Model Answer: ${safeSampleAnswer}\\n`;
          if (safeRubric) helpText += `Rubric: ${safeRubric}`;
          script += `  item.setHelpText('${helpText}');\n`;
        }
      } else {
        const safeExplanation = (q.explanation || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
        
        script += `  item = form.addMultipleChoiceItem();\n`;
        script += `  item.setTitle('${index + 1}. ${safeQuestion}');\n`;
        if (isQuizMode) {
          script += `  item.setPoints(1);\n`;
        }
        
        // Construct choices
        script += `  item.setChoices([\n`;
        if (q.options) {
          q.options.forEach((opt, optIndex) => {
            const safeOpt = opt.replace(/'/g, "\\'").replace(/\n/g, "\\n");
            const isCorrect = (opt === q.correctAnswer);
            const isLast = optIndex === q.options.length - 1;
            script += `    item.createChoice('${safeOpt}', ${isCorrect})${isLast ? '' : ','}\n`;
          });
        }
        script += `  ]);\n`;
        
        if (isQuizMode && safeExplanation) {
          script += `  // Explanation / Feedback\n`;
          script += `  var feedback = FormApp.createFeedback()\n`;
          script += `    .setText('${safeExplanation}')\n`;
          script += `    .build();\n`;
          script += `  item.setFeedbackForCorrect(feedback);\n`;
          script += `  item.setFeedbackForIncorrect(feedback);\n`;
        }
      }
      script += `\n`;
    });
  }

  script += `  Logger.log('Google Form Assessment created successfully!');\n`;
  script += `  Logger.log('Edit URL: ' + form.getEditUrl());\n`;
  script += `  Logger.log('Published URL (Share with students): ' + form.getPublishedUrl());\n`;
  script += `}\n`;

  return script;
}

/**
 * Generate Markdown formatting for the custom assessment.
 */
export function generateQuizMarkdown(quiz) {
  if (!quiz) return "";
  
  const purposeLabels = {
    quiz: "Practice Quiz",
    exam: "Exam Prep",
    homework: "Homework Assignment"
  };
  const label = purposeLabels[quiz.purpose] || "Assessment";
  
  let md = `# ${quiz.title || "Custom Assessment"}\n\n`;
  md += `This ${label.toLowerCase()} contains ${quiz.questions?.length || 0} questions to test understanding of the material. Difficulty: ${quiz.difficulty || "medium"}.\n\n---\n\n`;
  
  if (quiz.questions) {
    quiz.questions.forEach((q, index) => {
      md += `### Question ${index + 1}\n${q.question || ""}\n\n`;
      if (q.type === 'theory') {
        md += `*Write your response in the space below:*\n\n\n\n\n`;
      } else {
        const optionLabels = ['A', 'B', 'C', 'D'];
        if (q.options) {
          q.options.forEach((opt, optIndex) => {
            md += `- [ ] **${optionLabels[optIndex]}**: ${opt}\n`;
          });
        }
      }
      md += `\n`;
    });
    
    md += `\n---\n\n## Answer Key & Explanations\n\n`;
    quiz.questions.forEach((q, index) => {
      md += `#### Question ${index + 1}\n`;
      if (q.type === 'theory') {
        md += `* **Sample Answer**: ${q.sampleAnswer || ""}\n`;
        md += `* **Grading Rubric**: ${q.gradingRubric || ""}\n\n`;
      } else {
        md += `* **Correct Answer**: ${q.correctAnswer || ""}\n`;
        md += `* **Explanation**: ${q.explanation || ""}\n\n`;
      }
    });
  }
  
  return md;
}

