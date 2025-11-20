import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { SimulationRunSheet } from "@/components/SimulationRunSheet";

interface PlaybookData {
  success: boolean;
  playbook?: string;
  error?: string;
  metadata?: {
    negotiation_id: string;
    company_name: string;
    opponent_name: string;
    negotiation_title: string;
    model: string;
    prompt_version: number;
  };
}

export default function PlaybookPage() {
  const [, params] = useRoute("/playbook/:id");
  const negotiationId = params?.id;
  const [selectedSimulationRunId, setSelectedSimulationRunId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, error } = useQuery<PlaybookData>({
    queryKey: [`/api/negotiations/${negotiationId}/playbook`],
    enabled: !!negotiationId,
  });

  // Process playbook to fix escaped markdown links
  const processedPlaybook = data?.playbook
    ? data.playbook
        // Remove ALL backslash escapes from markdown links (aggressive cleaning)
        .replace(/\\(\[)/g, '$1')  // Remove \[ -> [
        .replace(/\\(\])/g, '$1')  // Remove \] -> ]
        .replace(/\\(\()/g, '$1')  // Remove \( -> (
        .replace(/\\(\))/g, '$1')  // Remove \) -> )
    : '';

  // Debug: Log a sample of the processed playbook
  if (processedPlaybook && typeof window !== 'undefined') {
    const sampleMatch = processedPlaybook.match(/\[44be5c86[^\]]*\][^\n]*/);
    if (sampleMatch) {
      console.log('DEBUG - Found link sample:', sampleMatch[0]);
    }
  }

  // Helper to detect if a string is a UUID
  const isSimulationRunUUID = (text: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
  };

  // Handler for clicking on simulation run links
  const handleSimulationRunClick = (runId: string) => {
    setSelectedSimulationRunId(runId);
    setSheetOpen(true);
  };

  const handleDownload = () => {
    if (!data?.playbook) return;

    const blob = new Blob([data.playbook], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playbook-${data.metadata?.negotiation_title || 'negotiation'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Generating playbook...</p>
            <p className="text-sm text-muted-foreground">This may take up to 2 minutes</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Playbook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Failed to load playbook'}
            </p>
            <Link href={`/analysis/${negotiationId}`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Analysis
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.success || !data.playbook) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Playbook Generation Failed
            </CardTitle>
            <CardDescription>{data?.error || 'Unknown error occurred'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/analysis/${negotiationId}`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Analysis
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/analysis/${negotiationId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Negotiation Playbook</h1>
            {data.metadata && (
              <p className="text-sm text-muted-foreground mt-1">
                {data.metadata.negotiation_title} · {data.metadata.company_name} vs {data.metadata.opponent_name}
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleDownload} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download Markdown
        </Button>
      </div>

      {/* Playbook Content */}
      <Card>
        <CardContent className="p-8">
          <div className="prose prose-neutral dark:prose-invert max-w-none
            prose-headings:font-bold
            prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-8 prose-h1:pb-2 prose-h1:border-b
            prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-6
            prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-4
            prose-p:leading-7 prose-p:mb-4
            prose-ul:my-4 prose-ul:ml-6
            prose-ol:my-4 prose-ol:ml-6
            prose-li:my-1
            prose-strong:font-semibold prose-strong:text-foreground
            prose-table:w-full prose-table:border-collapse
            prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left
            prose-td:border prose-td:border-border prose-td:p-2
            prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
            prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, children, href, ...props }) => {
                  // Extract text from children (can be string or array)
                  let childText = '';
                  if (typeof children === 'string') {
                    childText = children;
                  } else if (Array.isArray(children)) {
                    childText = children.map(c => typeof c === 'string' ? c : '').join('');
                  } else if (children) {
                    childText = children.toString();
                  }

                  const hrefText = href || '';

                  // Check if the link text (children) is a UUID (simulation run ID)
                  if (isSimulationRunUUID(childText.trim())) {
                    return (
                      <a
                        onClick={(e) => {
                          e.preventDefault();
                          handleSimulationRunClick(childText.trim());
                        }}
                        className="cursor-pointer text-primary hover:underline font-medium"
                        {...props}
                      >
                        {hrefText || childText}
                      </a>
                    );
                  }

                  // Check if href is a UUID (alternative format)
                  if (isSimulationRunUUID(hrefText.trim())) {
                    return (
                      <a
                        onClick={(e) => {
                          e.preventDefault();
                          handleSimulationRunClick(hrefText.trim());
                        }}
                        className="cursor-pointer text-primary hover:underline font-medium"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  }

                  // Regular link
                  return <a href={href} {...props}>{children}</a>;
                }
              }}
            >
              {processedPlaybook}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Metadata Footer */}
      {data.metadata && (
        <Card className="mt-6 bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Generated with {data.metadata.model} · Prompt v{data.metadata.prompt_version}
              </div>
              <div>
                Negotiation ID: {data.metadata.negotiation_id.slice(0, 8)}...
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulation Run Details Sheet */}
      <SimulationRunSheet
        simulationRunId={selectedSimulationRunId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
