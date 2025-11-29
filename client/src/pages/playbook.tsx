import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, AlertCircle, FileText, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { SimulationRunSheet } from "@/components/SimulationRunSheet";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
    total_runs?: number;
    generated_at?: string;
  };
}

export default function PlaybookPage() {
  const [, params] = useRoute("/playbook/:id");
  const negotiationId = params?.id;
  const [selectedSimulationRunId, setSelectedSimulationRunId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);

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

  // Extract headings for Mini-TOC
  const toc = useMemo(() => {
    if (!processedPlaybook) return [];
    const headings: { id: string; text: string; level: number }[] = [];
    const lines = processedPlaybook.split('\n');
    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        headings.push({ id, text, level });
      }
    });
    return headings;
  }, [processedPlaybook]);

  // Helper to detect if a string is a UUID
  const isSimulationRunUUID = (text: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
  };

  // Handler for clicking on simulation run links
  const handleSimulationRunClick = (runId: string) => {
    setSelectedSimulationRunId(runId);
    setSheetOpen(true);
  };

  const handleDownloadMarkdown = () => {
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

  const handlePrintPDF = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-lg font-medium">Playbook wird generiert...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Die KI analysiert alle Simulationsergebnisse und erstellt strategische Empfehlungen.
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
                  <p className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    Simulationsdaten werden geladen
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="animate-pulse text-primary">●</span>
                    KI-Analyse läuft (bis zu 5 Minuten)
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <span>○</span>
                    Playbook wird formatiert
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bitte schließen Sie dieses Fenster nicht.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load playbook';
    const is504 = errorMessage.includes('504');
    const isTimeout = is504 || errorMessage.toLowerCase().includes('timeout');

    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {isTimeout ? 'Zeitüberschreitung bei der Playbook-Generierung' : 'Fehler beim Laden des Playbooks'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTimeout ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Die Playbook-Generierung hat länger gedauert als erwartet. Das kann bei großen Verhandlungen mit vielen Simulationen vorkommen.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                  <p className="font-medium">Was Sie tun können:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Warten Sie einen Moment und laden Sie die Seite neu</li>
                    <li>Das Playbook wird möglicherweise im Hintergrund generiert</li>
                    <li>Prüfen Sie die Langfuse-Traces für den Generierungsstatus</li>
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Seite neu laden
              </Button>
              <Link href={`/analysis/${negotiationId}`}>
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Zurück zur Analyse
                </Button>
              </Link>
            </div>
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

  // Format date safely
  const formattedDate = data.metadata?.generated_at 
    ? format(new Date(data.metadata.generated_at), "dd.MM.yyyy", { locale: de }) 
    : format(new Date(), "dd.MM.yyyy", { locale: de });

  return (
    <div className="container mx-auto p-6 max-w-5xl print:p-0 print:max-w-none">
      {/* Header - Hidden in Print mode because we style our own print header or just let the content speak */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href={`/analysis/${negotiationId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Negotiation Playbook</h1>
            {data.metadata && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{data.metadata.company_name} vs {data.metadata.opponent_name}</span>
                <span>•</span>
                <span>{formattedDate}</span>
                {data.metadata.total_runs !== undefined && (
                   <>
                    <span>•</span>
                    <span>{data.metadata.total_runs} Simulationen</span>
                   </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownloadMarkdown} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Markdown
          </Button>
          <Button onClick={handlePrintPDF} variant="default">
            <Download className="mr-2 h-4 w-4" />
            Als PDF
          </Button>
        </div>
      </div>

      {/* Mini TOC */}
      {toc.length > 0 && (
        <Card className="mb-6 bg-muted/30 print:hidden border-none shadow-none">
          <CardHeader className="pb-2 pt-4 px-6 flex flex-row items-center justify-between cursor-pointer" onClick={() => setIsTocOpen(!isTocOpen)}>
            <CardTitle className="text-lg font-semibold">Inhaltsverzeichnis</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {isTocOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {isTocOpen && (
            <CardContent className="pb-4 px-6">
              <div className="flex flex-col gap-1.5 text-sm">
                {toc.map((item) => (
                  <a 
                    key={item.id} 
                    href={`#${item.id}`}
                    className={`
                      text-muted-foreground hover:text-primary transition-colors hover:underline decoration-primary/50 block
                      ${item.level === 1 ? 'font-semibold text-foreground mt-2 first:mt-0' : ''}
                      ${item.level === 2 ? 'pl-4' : ''}
                      ${item.level === 3 ? 'pl-8' : ''}
                    `}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    {item.text}
                  </a>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b pb-4">
        <h1 className="text-4xl font-bold mb-2">Negotiation Playbook</h1>
        <div className="text-lg text-gray-600">
          <p>{data.metadata?.company_name} vs {data.metadata?.opponent_name}</p>
          <p className="text-sm mt-1">
            Erstellt am {formattedDate} • Basierend auf {data.metadata?.total_runs ?? '?'} Simulationen
          </p>
        </div>
      </div>

      {/* Playbook Content */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8 print:p-0">
          <div className="prose prose-neutral dark:prose-invert max-w-none print:prose-sm
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
                h1: ({ children, ...props }) => {
                  const text = children?.toString() || '';
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                  return <h1 id={id} {...props}>{children}</h1>;
                },
                h2: ({ children, ...props }) => {
                  const text = children?.toString() || '';
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                  return <h2 id={id} {...props}>{children}</h2>;
                },
                h3: ({ children, ...props }) => {
                  const text = children?.toString() || '';
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                  return <h3 id={id} {...props}>{children}</h3>;
                },
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
                        className="cursor-pointer text-primary hover:underline font-medium print:no-underline print:text-black"
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
                        className="cursor-pointer text-primary hover:underline font-medium print:no-underline print:text-black"
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

      {/* Metadata Footer - Hidden in Print as we have a header */}
      {data.metadata && (
        <Card className="mt-6 bg-muted/50 print:hidden">
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
