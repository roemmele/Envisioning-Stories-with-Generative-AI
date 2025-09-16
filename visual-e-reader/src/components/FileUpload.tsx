import { useState, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, File } from "lucide-react";
interface FileUploadProps {
  onFileLoad: (content: string, filename: string) => void;
}
export const FileUpload = ({
  onFileLoad
}: FileUploadProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    toast
  } = useToast();
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setIsLoading(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'txt') {
        // Handle text files
        const text = await file.text();
        onFileLoad(text, file.name);
        toast({
          title: "File loaded successfully",
          description: `${file.name} has been loaded into the e-reader.`
        });
      } else if (fileExtension === 'pdf') {
        // Handle PDF files
        const arrayBuffer = await file.arrayBuffer();

        // Import pdf-parse dynamically since it's a Node.js library
        try {
          // For browser environment, we'll need to use a different approach
          // Let's create a simple fallback for now
          toast({
            title: "PDF support coming soon",
            description: "PDF parsing is being implemented. Please use .txt files for now.",
            variant: "destructive"
          });
        } catch (error) {
          console.error('PDF parsing error:', error);
          toast({
            title: "Error loading PDF",
            description: "There was an error parsing the PDF file. Please try a .txt file instead.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Unsupported file type",
          description: "Please upload a .txt or .pdf file.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Error loading file",
        description: "There was an error reading the file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [onFileLoad, toast]);
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  return <div className="flex items-center gap-2">
      {/* Hidden file input */}
      <Input ref={fileInputRef} type="file" accept=".txt,.pdf" onChange={handleInputChange} className="hidden" disabled={isLoading} />
      
      {/* Visible button */}
      <Button variant="outline" size="sm" disabled={isLoading} onClick={handleButtonClick} className="text-muted-foreground hover:text-foreground">
        {isLoading ? <>
            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Loading...
          </> : <>
            <Upload className="h-4 w-4 mr-2" />
            Upload .txt File
          </>}
      </Button>
      
      
    </div>;
};