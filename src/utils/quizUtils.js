/**
 * Generate Google Apps Script code to create a Google Form quiz.
 */
export function generateGoogleFormsAppsScript(quiz) {
  const safeTitle = (quiz.title || "Practice Quiz").replace(/'/g, "\\'");
  
  let script = `/**
 * Google Apps Script to automatically generate a Google Form Quiz for:
 * "${quiz.title || "Practice Quiz"}"
 *
 * How to use:
 * 1. Open Google Drive (drive.google.com).
 * 2. Click "New" > "More" > "Google Apps Script" (or visit script.google.com).
 * 3. Delete any default code and paste this script.
 * 4. Click the "Save" icon (or Ctrl+S).
 * 5. Select the "createFormQuiz" function in the toolbar and click "Run".
 * 6. Grant the necessary permissions when prompted (it will require access to Google Forms and Google Drive to create the form file).
 * 7. Open Google Drive (or check script logs) to access your newly created Google Form quiz!
 */

function createFormQuiz() {
  var form = FormApp.create('${safeTitle}');
  form.setIsQuiz(true);
  form.setConfirmationMessage('Thank you for completing the quiz! Your score has been recorded.');
  
  // Student Details
  form.addSectionHeaderItem().setTitle('Student Information');
  form.addTextItem().setTitle('Full Name').setRequired(true);
  form.addTextItem().setTitle('Class / Section').setRequired(true);
  form.addTextItem().setTitle('School / Institution').setRequired(true);
  
  // Separate Identification from Quiz Questions
  form.addPageBreakItem().setTitle('Practice Quiz');
  
  var item, choice;
  
`;

  if (quiz && quiz.questions) {
    quiz.questions.forEach((q, index) => {
      const safeQuestion = (q.question || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
      const safeExplanation = (q.explanation || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
      
      script += `  // Question ${index + 1}\n`;
      script += `  item = form.addMultipleChoiceItem();\n`;
      script += `  item.setTitle('${index + 1}. ${safeQuestion}');\n`;
      script += `  item.setPoints(1);\n`;
      
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
      
      if (safeExplanation) {
        script += `  // Explanation / Feedback\n`;
        script += `  var feedback = FormApp.createFeedback()\n`;
        script += `    .setText('${safeExplanation}')\n`;
        script += `    .build();\n`;
        script += `  item.setFeedbackForCorrect(feedback);\n`;
        script += `  item.setFeedbackForIncorrect(feedback);\n`;
      }
      script += `\n`;
    });
  }

  script += `  Logger.log('Google Form Quiz created successfully!');\n`;
  script += `  Logger.log('Edit URL: ' + form.getEditUrl());\n`;
  script += `  Logger.log('Published URL (Share with students): ' + form.getPublishedUrl());\n`;
  script += `}\n`;

  return script;
}

/**
 * Generate Markdown formatting for the quiz.
 */
export function generateQuizMarkdown(quiz) {
  if (!quiz) return "";
  
  let md = `# ${quiz.title || "Practice Quiz"}\n\n`;
  md += `This practice quiz contains 20 multiple choice questions to test understanding of the material. Select the best answer for each question.\n\n---\n\n`;
  
  if (quiz.questions) {
    quiz.questions.forEach((q, index) => {
      md += `### Question ${index + 1}\n${q.question || ""}\n\n`;
      const optionLabels = ['A', 'B', 'C', 'D'];
      if (q.options) {
        q.options.forEach((opt, optIndex) => {
          md += `- [ ] **${optionLabels[optIndex]}**: ${opt}\n`;
        });
      }
      md += `\n`;
    });
    
    md += `\n---\n\n## Answer Key & Explanations\n\n`;
    quiz.questions.forEach((q, index) => {
      md += `#### Question ${index + 1}\n`;
      md += `* **Correct Answer**: ${q.correctAnswer || ""}\n`;
      md += `* **Explanation**: ${q.explanation || ""}\n\n`;
    });
  }
  
  return md;
}
