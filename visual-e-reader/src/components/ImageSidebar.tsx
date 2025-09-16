import { Highlight } from "./EReader";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Loader2, Download, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
interface ImageSidebarProps {
  highlights: Highlight[];
  onClearAll: () => void;
}
export const ImageSidebar = ({
  highlights,
  onClearAll
}: ImageSidebarProps) => {
  const { toast } = useToast();

  const handleClearAll = () => {
    onClearAll();
    toast({
      title: "Highlight cleared",
      description: "The highlight and generated image have been removed.",
    });
  };

  // Get the single current highlight (should only be one with new logic)
  const currentHighlight = highlights[0];

  return <aside className="flex-1 bg-sidebar border-l border-sidebar-border overflow-auto">
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Image</h2>
        {currentHighlight && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="text-xs text-muted-foreground hover:text-foreground hover:border-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {currentHighlight ? (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {currentHighlight.imageUrl && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentHighlight.isGeneratingImage ? <div className="aspect-[4/3] bg-muted rounded-md flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div> : currentHighlight.imageUrl ? <img src={currentHighlight.imageUrl} alt="Generated illustration" className="w-full aspect-[4/3] object-cover rounded-md border border-border" /> : null}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8">
          <div className="text-muted-foreground mb-2">
            <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No highlights yet</p>
            <p className="text-xs">Select text to apply imagination</p>
          </div>
        </div>
      )}
    </div>
  </aside>;
};