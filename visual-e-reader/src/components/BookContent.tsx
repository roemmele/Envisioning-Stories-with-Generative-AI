import { useEffect, useRef, useMemo } from "react";
import { Highlight } from "./EReader";

interface BookContentProps {
  highlights: Highlight[];
  onTextSelection: (startWordIndex: number, endWordIndex: number, text: string) => void;
  content?: string | null;
}

interface WordInfo {
  word: string;
  index: number;
  isWhitespace: boolean;
}

export const BookContent = ({ highlights, onTextSelection, content }: BookContentProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Use uploaded content or fall back to sample content
  const bookContent = content || "";

  // Parse content into words with stable indices
  const wordsWithIndices = useMemo(() => {
    const words: WordInfo[] = [];
    let wordIndex = 0;

    // Split on word boundaries, keeping everything
    const tokens = bookContent.match(/\S+|\s+/g) || [];

    tokens.forEach(token => {
      if (token.trim()) {
        // This is a word/token
        words.push({
          word: token,
          index: wordIndex++,
          isWhitespace: false
        });
      } else {
        // This is whitespace
        words.push({
          word: token,
          index: -1,
          isWhitespace: true
        });
      }
    });

    return words;
  }, [bookContent]);

  // Get word indices from selection by finding the text in original content
  const getWordIndicesFromSelection = (selection: Selection): { startIndex: number; endIndex: number; text: string } | null => {
    const selectedText = selection.toString().trim();
    console.log('Selected text:', selectedText);
    console.log('Selected text length:', selectedText.length);

    if (!selectedText) return null;

    // For multi-paragraph selections, we need to normalize whitespace
    // because the DOM selection might have different whitespace than the original
    const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
    const normalizedContent = bookContent.replace(/\s+/g, ' ').trim();

    console.log('Normalized selected:', normalizedSelected.substring(0, 50) + '...');

    // Find this text in the normalized original content
    const textStart = normalizedContent.indexOf(normalizedSelected);
    if (textStart === -1) {
      console.log('Text not found in normalized content, trying partial matches...');

      // Try to find the start and end separately for better matching
      const words = normalizedSelected.split(' ');
      if (words.length > 5) {
        const startPhrase = words.slice(0, 3).join(' ');
        const endPhrase = words.slice(-3).join(' ');

        const startPos = normalizedContent.indexOf(startPhrase);
        const endPos = normalizedContent.lastIndexOf(endPhrase);

        if (startPos !== -1 && endPos !== -1 && endPos > startPos) {
          console.log('Found using phrase matching');
          const extractedText = normalizedContent.substring(startPos, endPos + endPhrase.length);
          return getWordIndicesFromNormalizedText(extractedText, startPos);
        }
      }

      return null;
    }

    console.log('Found text at normalized position:', textStart);
    return getWordIndicesFromNormalizedText(normalizedSelected, textStart);
  };

  const getWordIndicesFromNormalizedText = (text: string, startPos: number): { startIndex: number; endIndex: number; text: string } | null => {
    // Map back from normalized position to word indices
    let currentNormalizedPos = 0;
    let startWordIndex = -1;
    let endWordIndex = -1;

    for (let i = 0; i < wordsWithIndices.length; i++) {
      const wordInfo = wordsWithIndices[i];

      if (!wordInfo.isWhitespace) {
        const wordEndPos = currentNormalizedPos + wordInfo.word.length;

        // Check if this word overlaps with our text
        if (wordEndPos > startPos && currentNormalizedPos < startPos + text.length) {
          if (startWordIndex === -1) {
            startWordIndex = wordInfo.index;
          }
          endWordIndex = wordInfo.index;
        }

        currentNormalizedPos = wordEndPos + 1; // +1 for space
      }
    }

    console.log('Word indices:', startWordIndex, 'to', endWordIndex);

    if (startWordIndex >= 0 && endWordIndex >= 0) {
      // Get the actual text that corresponds to these word indices
      const actualHighlightedText = wordsWithIndices
        .filter(wordInfo => !wordInfo.isWhitespace && wordInfo.index >= startWordIndex && wordInfo.index <= endWordIndex)
        .map(wordInfo => wordInfo.word.trim())
        .join(' ')
        .trim();

      console.log('Actual highlighted text:', actualHighlightedText.substring(0, 50) + '...');

      return { startIndex: startWordIndex, endIndex: endWordIndex, text: actualHighlightedText };
    }

    return null;
  };

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        const selectedText = selection.toString().trim();
        if (selectedText.length > 3) {
          // Check if selection spans multiple paragraphs
          const range = selection.getRangeAt(0);
          const container = contentRef.current;

          if (container) {
            // Check if the selection crosses paragraph boundaries
            const startParagraph = range.startContainer.nodeType === Node.TEXT_NODE
              ? range.startContainer.parentElement?.closest('p')
              : range.startContainer instanceof Element
                ? range.startContainer.closest('p')
                : null;

            const endParagraph = range.endContainer.nodeType === Node.TEXT_NODE
              ? range.endContainer.parentElement?.closest('p')
              : range.endContainer instanceof Element
                ? range.endContainer.closest('p')
                : null;

            // Only allow highlighting within the same paragraph
            if (startParagraph && endParagraph && startParagraph === endParagraph) {
              const wordIndices = getWordIndicesFromSelection(selection);

              // Clear the selection immediately
              selection.removeAllRanges();

              if (wordIndices) {
                onTextSelection(wordIndices.startIndex, wordIndices.endIndex, wordIndices.text);
              }
            } else {
              // Clear selection if it spans multiple paragraphs
              selection.removeAllRanges();
              console.log('Selection spans multiple paragraphs - not allowed');
            }
          }
        }
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('mouseup', handleSelection);
      return () => contentElement.removeEventListener('mouseup', handleSelection);
    }
  }, [onTextSelection]);

  const renderContentWithHighlights = () => {
    // Create a map of word indices to highlight arrays
    const wordHighlights = new Map<number, Highlight[]>();

    highlights.forEach(highlight => {
      for (let i = highlight.startWordIndex; i <= highlight.endWordIndex; i++) {
        if (!wordHighlights.has(i)) {
          wordHighlights.set(i, []);
        }
        wordHighlights.get(i)!.push(highlight);
      }
    });

    let html = '';
    let currentHighlights: Highlight[] = [];

    wordsWithIndices.forEach((wordInfo, i) => {
      if (wordInfo.isWhitespace) {
        // Only add whitespace if we're not inside a highlight, or if it's between highlighted words
        const nextWordInfo = wordsWithIndices[i + 1];
        const prevWordInfo = wordsWithIndices[i - 1];

        const nextHighlights = nextWordInfo && !nextWordInfo.isWhitespace ? wordHighlights.get(nextWordInfo.index) || [] : [];
        const prevHighlights = prevWordInfo && !prevWordInfo.isWhitespace ? wordHighlights.get(prevWordInfo.index) || [] : [];

        // Add whitespace if we're not transitioning out of a highlight, or if both sides have same highlights
        if (currentHighlights.length === 0 || (nextHighlights.length > 0 && prevHighlights.length > 0)) {
          html += wordInfo.word;
        } else if (nextHighlights.length === 0) {
          // Add whitespace when exiting a highlight
          html += wordInfo.word;
        }
        return;
      }

      const highlights = wordHighlights.get(wordInfo.index) || [];

      // Check if we need to close any highlights
      const highlightsToClose = currentHighlights.filter(current =>
        !highlights.some(h => h.id === current.id)
      );

      // Close highlights in reverse order
      highlightsToClose.reverse().forEach(() => {
        html += '</mark>';
      });

      // Check if we need to open any new highlights
      const highlightsToOpen = highlights.filter(highlight =>
        !currentHighlights.some(current => current.id === highlight.id)
      );

      // Open new highlights
      highlightsToOpen.forEach(highlight => {
        const baseStyle = "background-color: #d4c5a9 !important; color: inherit !important; border-radius: 2px; padding: 1px 2px;";
        html += `<mark data-highlight-id="${highlight.id}" style="${baseStyle}">`;
      });

      currentHighlights = highlights;
      html += wordInfo.word;
    });

    // Close any remaining highlights
    for (let i = 0; i < currentHighlights.length; i++) {
      html += '</mark>';
    }

    // Now carefully process into paragraphs while preserving highlight tags
    return processIntoParagraphs(html);
  };

  const processIntoParagraphs = (htmlWithHighlights: string): string => {
    // Split content while being careful not to break highlight tags
    // First, handle double newlines as paragraph breaks
    const sections = htmlWithHighlights.split(/\n\s*\n/);

    return sections.map(section => {
      section = section.trim();
      if (!section) return '';

      if (section.startsWith('#')) {
        const level = section.match(/^#+/)?.[0].length || 1;
        const text = section.replace(/^#+\s*/, '');
        return `<h${level}>${text}</h${level}>`;
      }

      // Convert single newlines within paragraphs to <br> tags
      const textWithBreaks = section.replace(/\n/g, '<br>');
      return `<p>${textWithBreaks}</p>`;
    }).join('');
  };

  // Show empty state when no content is loaded
  if (!bookContent.trim()) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-card border border-border rounded-lg shadow-lg">
          <div className="p-8 md:p-12 text-center">
            <div className="text-muted-foreground mb-4">
              <h2 className="text-xl font-semibold mb-2">No Book Loaded</h2>
              <p className="text-sm">Upload a .txt or .pdf file to start reading and creating highlights</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-card border border-border rounded-lg shadow-lg">
        <div className="p-8 md:p-12">
          <div
            ref={contentRef}
            className="reading-content prose prose-lg max-w-none font-reading text-reading-text leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: renderContentWithHighlights()
            }}
          />
        </div>
      </div>
    </div>
  );
};