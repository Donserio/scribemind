import React, { useState } from 'react';

const NOTE_STYLES = [
  { id: 'standard', name: 'Study Notes', icon: '📝', desc: 'Heading structures, clear bullet points, bold key terms.' },
  { id: 'chapter', name: 'Textbook Chapter', icon: '📖', desc: 'Thorough paragraphs, structured sections, academic prose.' },
  { id: 'qa', name: 'Q&A Guide', icon: '❓', desc: 'Detailed question and answer format, great for self-study.' },
  { id: 'dialogue', name: 'Conversational Tutor', icon: '💬', desc: 'A lively Socratic dialog between tutor and student.' },
  { id: 'lesson', name: 'Lesson Plan', icon: '👩‍🏫', desc: 'Objectives, timelines, discussion prompts, slide scripts.' },
  { id: 'cheat', name: 'Cheat Sheet', icon: '⚡', desc: 'Tables, lists, ultra-condensed summaries for quick revision.' }
];

const CONTENT_MODULES = [
  { id: 'vocabulary', title: 'Vocabulary Glossary', desc: 'Key terms defined at the start' },
  { id: 'analogies', title: 'Analogies & Examples', desc: 'Visual real-world comparisons' },
  { id: 'misconceptions', title: 'Common Pitfalls', desc: 'Frequent student errors explained' },
  { id: 'solvedProblems', title: 'Step-by-Step Exercises', desc: 'Solved practice math/science runs' },
  { id: 'activities', title: 'Hands-on Activity', desc: 'Simple experiment or project idea' },
  { id: 'quiz', title: '5-Question Review Quiz', desc: 'Includes answers at the bottom' }
];

const PREDEFINED_MODELS = [
  // Google Gemini
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Google)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Google)' },
  // OpenAI
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  // Anthropic Claude
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Anthropic)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Anthropic)' },
  // DeepSeek
  { value: 'deepseek-chat', label: 'DeepSeek V3 (DeepSeek)' },
  { value: 'deepseek-reasoner', label: 'DeepSeek R1 (DeepSeek)' },
  // OpenRouter Free Models
  { value: 'openrouter/meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B Free (OpenRouter)' },
  { value: 'openrouter/deepseek/deepseek-r1:free', label: 'DeepSeek R1 Free (OpenRouter)' },
  { value: 'openrouter/google/gemini-2.5-flash:free', label: 'Gemini 2.5 Flash Free (OpenRouter)' }
];

export default function Customizer({
  settings,
  onChange
}) {

  const handleTextChange = (field, val) => {
    onChange({ ...settings, [field]: val });
  };

  const toggleModule = (moduleId) => {
    const currentModules = settings.modules || {};
    onChange({
      ...settings,
      modules: {
        ...currentModules,
        [moduleId]: !currentModules[moduleId]
      }
    });
  };

  const handleStyleSelect = (styleId) => {
    onChange({ ...settings, noteStyle: styleId });
  };

  return (
    <div className="customizer-form">
      {/* Grade Level */}
      <div className="form-group">
        <label className="form-label">Target Grade / Audience</label>
        <select
          className="form-select"
          value={settings.gradeLevel}
          onChange={(e) => handleTextChange('gradeLevel', e.target.value)}
        >
          <option value="primary">Primary School (Ages 6-10)</option>
          <option value="middle">Middle School (Ages 11-13)</option>
          <option value="high">High School (Ages 14-18)</option>
          <option value="college">College / Undergraduate</option>
          <option value="professional">Professional / Adult</option>
        </select>
      </div>

      {/* Note Style Selector */}
      <div className="form-group">
        <label className="form-label">Note Style & Format</label>
        <div className="style-grid">
          {NOTE_STYLES.map((style) => (
            <div
              key={style.id}
              className={`style-card ${settings.noteStyle === style.id ? 'selected' : ''}`}
              onClick={() => handleStyleSelect(style.id)}
            >
              <span className="style-icon">{style.icon}</span>
              <span className="style-name">{style.name}</span>
              <span className="style-desc">{style.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Depth Slider */}
      <div className="form-group">
        <label className="form-label">Technical Depth</label>
        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            className="range-slider"
            value={
              settings.depth === 'conceptual' ? 0 :
              settings.depth === 'balanced' ? 1 : 2
            }
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const depthStr = val === 0 ? 'conceptual' : val === 1 ? 'balanced' : 'technical';
              handleTextChange('depth', depthStr);
            }}
          />
          <div className="slider-labels">
            <span style={{ fontWeight: settings.depth === 'conceptual' ? 'bold' : 'normal' }}>Conceptual</span>
            <span style={{ fontWeight: settings.depth === 'balanced' ? 'bold' : 'normal' }}>Balanced</span>
            <span style={{ fontWeight: settings.depth === 'technical' ? 'bold' : 'normal' }}>Technical</span>
          </div>
        </div>
      </div>

      {/* Content Modules */}
      <div className="form-group">
        <label className="form-label">Special Inclusions (Toggles)</label>
        <div className="modules-grid">
          {CONTENT_MODULES.map((mod) => {
            const isActive = !!(settings.modules && settings.modules[mod.id]);
            return (
              <div
                key={mod.id}
                className={`module-toggle-item ${isActive ? 'active' : ''}`}
                onClick={() => toggleModule(mod.id)}
              >
                <div className="module-info">
                  <span className="module-title">{mod.title}</span>
                  <span className="module-desc">{mod.desc}</span>
                </div>
                <label className="switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleModule(mod.id)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Prompt Override */}
      <div className="form-group">
        <label className="form-label">Custom Learning Guidelines</label>
        <textarea
          className="form-textarea"
          rows="3"
          placeholder="E.g., 'Relate explanations to sports', 'Focus on practical laboratory steps', 'Translate key points to French'..."
          value={settings.customPrompt}
          onChange={(e) => handleTextChange('customPrompt', e.target.value)}
        />
      </div>

      {/* Generation Method */}
      <div className="form-group">
        <label className="form-label">Generation Method</label>
        <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="radio"
              name="generationMethod"
              value="single"
              checked={settings.generationMethod !== 'step'}
              onChange={() => handleTextChange('generationMethod', 'single')}
              style={{ cursor: 'pointer' }}
            />
            <span>Single Pass (Fast)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="radio"
              name="generationMethod"
              value="step"
              checked={settings.generationMethod === 'step'}
              onChange={() => handleTextChange('generationMethod', 'step')}
              style={{ cursor: 'pointer' }}
            />
            <span>Step-by-Step (High Detail)</span>
          </label>
        </div>
      </div>

      {/* Model Selection */}
      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label">AI Model Configuration</label>
        <select
          className="form-select"
          value={PREDEFINED_MODELS.some(m => m.value === settings.modelName) ? settings.modelName : 'custom'}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'custom') {
              handleTextChange('modelName', 'gemini-2.5-pro');
            } else {
              handleTextChange('modelName', val);
            }
          }}
        >
          {PREDEFINED_MODELS.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
          <option value="custom">Custom Model Identifier...</option>
        </select>
      </div>

      {!PREDEFINED_MODELS.some(m => m.value === settings.modelName) && (
        <div className="form-group" style={{ marginTop: '8px' }}>
          <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Custom Model ID</label>
          <input
            type="text"
            className="form-input"
            style={{ fontSize: '13px', padding: '6px 10px' }}
            placeholder="e.g. gemini-2.5-pro"
            value={settings.modelName}
            onChange={(e) => handleTextChange('modelName', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
