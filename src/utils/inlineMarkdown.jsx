import React from 'react';

// Renders **bold** inside a plain string (flashcard fronts from the offline engine are
// "What is the definition of **term**?"; they showed literal asterisks).
export function renderInline(text) {
  if (typeof text !== 'string' || !text.includes('**')) return text;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}
