import { useState, useEffect } from "react";
import { BookContent } from "./BookContent";
import { ImageSidebar } from "./ImageSidebar";
import { FileUpload } from "./FileUpload";
import { Button } from "./ui/button";
import { BookOpen, Image, Settings } from "lucide-react";

export interface Highlight {
  id: string;
  startWordIndex: number;
  endWordIndex: number;
  text: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

export const EReader = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showImageSidebar, setShowImageSidebar] = useState(true);
  const [bookContent, setBookContent] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>("Sample Book");
  const [isLoadingSample, setIsLoadingSample] = useState(true);

  // Load sample book content on component mount
  useEffect(() => {
    const loadSampleContent = async () => {
      try {
        const response = await fetch('/sample_book_content.txt');
        const content = await response.text();
        setBookContent(content);
        // Extract title from first line if it starts with #
        const lines = content.split('\n');
        const firstLine = lines[0]?.trim();
        if (firstLine && firstLine.startsWith('#')) {
          setBookTitle(firstLine.substring(1).trim());
        } else {
          setBookTitle("Untitled Book");
        }
      } catch (error) {
        console.error('Error loading sample content:', error);
        // Fallback to empty content if file loading fails
        setBookContent("");
      } finally {
        setIsLoadingSample(false);
      }
    };

    loadSampleContent();
  }, []);

  const handleFileLoad = (content: string, filename: string) => {
    setBookContent(content);
    setBookTitle(filename.replace(/\.(txt|pdf)$/i, ''));
    // Clear existing highlights when loading new content
    setHighlights([]);
  };

  const addHighlight = (startWordIndex: number, endWordIndex: number, text: string) => {
    const newHighlight: Highlight = {
      id: Date.now().toString(),
      startWordIndex,
      endWordIndex,
      text,
      isGeneratingImage: true // Start generating immediately
    };

    // Replace all previous highlights with the new one
    setHighlights([newHighlight]);

    // Start image generation immediately
    generateImageForHighlight(newHighlight);
  };

  const generateImageForHighlight = async (highlight: Highlight) => {
    console.log("Generating image for highlight:", highlight);

    // Extract context: 200 words before and after the highlight
    const words = bookContent.split(/\s+/);
    const contextStart = Math.max(0, highlight.startWordIndex - 200);
    const contextEnd = Math.min(words.length, highlight.endWordIndex + 200);
    const context = words.slice(contextStart, contextEnd).join(' ');

    // Set the highlight to generating state
    setHighlights(prev => prev.map(h => h.id === highlight.id ? {
      ...h,
      isGeneratingImage: true
    } : h));

    try {
      console.log("Generating image for highlight:", highlight.text);

      // Call the Python backend API to generate the image
      const response = await fetch("http://localhost:8000/api/envision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          passage: highlight.text,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      console.log("Image generated successfully:", data);

      // Update the highlight with the generated image
      setHighlights(prev => prev.map(h => h.id === highlight.id ? {
        ...h,
        isGeneratingImage: false,
        imageUrl: `http://localhost:8000/api/images/${data.image_id}` // Construct URL from image_id
      } : h));
    } catch (error) {
      console.error("Error generating image:", error);

      // On error, stop generating and leave imageUrl undefined
      setHighlights(prev => prev.map(h => h.id === highlight.id ? {
        ...h,
        isGeneratingImage: false
      } : h));
    }
  };
  const removeHighlight = (highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
  };
  const clearAllHighlights = () => {
    setHighlights([]);
  };
  return <div className="min-h-screen bg-reading-background">
    {/* Header */}
    <header className="border-b border-sidebar-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-primary">Visual E-Reader</h1>
          {bookContent && <span className="text-sm text-muted-foreground">• {bookTitle}</span>}
        </div>
        <div className="flex items-center gap-3">
          <FileUpload onFileLoad={handleFileLoad} />

          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>

    <div className="flex h-[calc(100vh-73px)]">
      {/* Main reading area */}
      <main className={`flex-1 ${showImageSidebar ? 'max-w-4xl' : ''}`}>
        <div className="h-full overflow-auto">
          {isLoadingSample ? (
            <div className="max-w-4xl mx-auto p-8">
              <div className="bg-card border border-border rounded-lg shadow-lg">
                <div className="p-8 md:p-12 text-center">
                  <div className="text-muted-foreground mb-4">
                    <h2 className="text-xl font-semibold mb-2">Loading Sample Book...</h2>
                    <p className="text-sm">Please wait while we load The Great Gatsby</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <BookContent highlights={highlights} onTextSelection={addHighlight} content={bookContent} />
          )}
        </div>
      </main>

      {/* Image sidebar */}
      {showImageSidebar && <ImageSidebar highlights={highlights} onClearAll={clearAllHighlights} />}
    </div>
  </div>;
};