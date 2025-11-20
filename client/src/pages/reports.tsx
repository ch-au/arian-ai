import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  Download,
  Calendar as CalendarIcon,
  Filter,
  Eye,
  Share2,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNegotiations, type NegotiationStatus } from "@/hooks/use-negotiations";
import type { NegotiationScenario } from "@/hooks/use-negotiations";
import { buildReportEntries, filterReportEntries } from "@/lib/report-helpers";

type UserRole = NonNullable<NegotiationScenario["userRole"]>;
type ExportFormat = "csv" | "excel" | "json";

const STATUS_FILTERS: { id: NegotiationStatus; label: string }[] = [
  { id: "planned", label: "Geplant" },
  { id: "running", label: "Laufend" },
  { id: "completed", label: "Abgeschlossen" },
  { id: "aborted", label: "Abgebrochen" },
];

const ROLE_FILTERS: { id: UserRole; label: string }[] = [
  { id: "buyer", label: "Käuferrolle" },
  { id: "seller", label: "Verkäuferrolle" },
];

const EXPORT_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "csv", label: "CSV" },
  { id: "excel", label: "Excel" },
  { id: "json", label: "JSON" },
];

function formatDate(value?: string) {
  if (!value) return "n. v.";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n. v.";
  return format(parsed, "dd.MM.yyyy", { locale: de });
}

export default function ReportsPage() {
  const [, setLocation] = useLocation();
  const { data: negotiations = [], isLoading } = useNegotiations();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<NegotiationStatus[]>(STATUS_FILTERS.map((s) => s.id));
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const reportEntries = useMemo(() => buildReportEntries(negotiations ?? []), [negotiations]);
  const filteredReports = useMemo(
    () =>
      filterReportEntries(reportEntries, {
        search: searchTerm,
        statuses: selectedStatuses,
        roles: selectedRoles,
        from: selectedDateRange.from,
        to: selectedDateRange.to,
      }),
    [reportEntries, searchTerm, selectedStatuses, selectedRoles, selectedDateRange]
  );

  const toggleStatus = (status: NegotiationStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleExport = async (negotiationId: string, format: ExportFormat) => {
    const key = `${negotiationId}:${format}`;
    setExportingKey(key);
    try {
      const response = await fetchWithAuth(`/api/analytics/export/${negotiationId}?format=${format}`);
      if (!response.ok) {
        throw new Error("Export fehlgeschlagen");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${negotiationId}-analyse.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Export error", error);
      alert("Export konnte nicht erstellt werden. Bitte später erneut versuchen.");
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Berichte & Exporte</h1>
          <p className="text-gray-600 mt-1">
            Alle Simulationsergebnisse lassen sich hier filtern, exportieren und für Stakeholder aufbereiten.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filteredReports.length} Datensätze verfügbar
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter & Zeitraum
            </CardTitle>
            <CardDescription>Eingrenzung nach Status, Rolle und Zeitraum</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Suche</Label>
              <Input
                id="search"
                placeholder="Unternehmen, Gegenpartei oder Markt"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Zeitraum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDateRange.from ? (
                      selectedDateRange.to ? (
                        `${format(selectedDateRange.from, "dd.MM.yyyy")} – ${format(
                          selectedDateRange.to,
                          "dd.MM.yyyy"
                        )}`
                      ) : (
                        format(selectedDateRange.from, "dd.MM.yyyy")
                      )
                    ) : (
                      "Zeitraum wählen"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    selected={{
                      from: selectedDateRange.from,
                      to: selectedDateRange.to,
                    }}
                    onSelect={(range) => {
                      setSelectedDateRange({
                        from: range?.from,
                        to: range?.to,
                      });
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="space-y-2">
                {STATUS_FILTERS.map((status) => (
                  <div key={status.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`status-${status.id}`}
                      checked={selectedStatuses.includes(status.id)}
                      onCheckedChange={() => toggleStatus(status.id)}
                    />
                    <Label htmlFor={`status-${status.id}`} className="font-normal">
                      {status.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rolle</Label>
              <div className="space-y-2">
                {ROLE_FILTERS.map((role) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selectedRoles.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <Label htmlFor={`role-${role.id}`} className="font-normal">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Export-Hinweis</CardTitle>
            <CardDescription>
              Jeder Eintrag repräsentiert eine Verhandlung mit eindeutiger Scenario-Konfiguration. Die Export-Buttons liefern
              sofortige CSV-, Excel- oder JSON-Dateien inklusive Produkt- und Dimensionsdaten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>👉 Tipp: Nutze die Filter, um Reports für einen bestimmten Zeitraum oder eine bestimmte Rolle zu erstellen.</p>
            <p>🔁 Die Liste aktualisiert sich automatisch, sobald neue Simulationen starten oder abschließen.</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        {isLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Lade Verhandlungen…</CardTitle>
              <CardDescription>Die neuesten Simulationen werden abgerufen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Keine Ergebnisse</CardTitle>
              <CardDescription>
                Passe die Filter an oder erweitere den Zeitraum, um weitere Verhandlungen zu sehen.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>{report.title}</CardTitle>
                  <CardDescription>{report.summary}</CardDescription>
                </div>
                <Badge>{report.statusLabel}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
                  <div>
                    <p className="text-xs uppercase text-gray-400">Unternehmen</p>
                    <p className="text-base text-foreground">{report.companyLabel}</p>
                    <p>Rolle: {report.userRole === "buyer" ? "Käufer" : report.userRole === "seller" ? "Verkäufer" : "n. v."}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Gegenpartei</p>
                    <p className="text-base text-foreground">{report.counterpartLabel}</p>
                    <p>Markt: {report.marketLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Zeit</p>
                    <p className="text-base text-foreground">{formatDate(report.createdAt)}</p>
                    <p>Aktualisiert: {formatDate(report.updatedAt)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    {report.simulationStats.completedRuns}/{report.simulationStats.totalRuns} Runs abgeschlossen
                  </Badge>
                  <Badge variant="outline">{report.techniqueCount} Techniken</Badge>
                  <Badge variant="outline">{report.tacticCount} Taktiken</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setLocation(`/negotiations/${report.id}/analysis`)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Analyse öffnen
                  </Button>
                  {EXPORT_FORMATS.map((formatItem) => (
                    <Button
                      key={`${report.id}-${formatItem.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(report.id, formatItem.id)}
                      disabled={exportingKey === `${report.id}:${formatItem.id}`}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {formatItem.label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 text-muted-foreground"
                    onClick={() => setLocation(`/analysis/${report.id}`)}
                  >
                    <Share2 className="w-4 h-4" />
                    Präsentationsmodus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
