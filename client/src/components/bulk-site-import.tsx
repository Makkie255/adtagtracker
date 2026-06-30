import { useMemo, useState } from "react";
import { Loader2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SiteFileUpload } from "@/components/site-file-upload";
import { useBulkCreateSites, useTagPlatforms } from "@/lib/api";
import { mergeImportRowWithDefaults } from "@/lib/site-import-utils";
import type { SiteImportRow } from "@shared/site-import";
import { SITE_IMPORT_CSV_TEMPLATE } from "@shared/site-import";

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkSiteImport() {
  const platformsQ = useTagPlatforms();
  const bulkCreate = useBulkCreateSites();

  const [rows, setRows] = useState<SiteImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!platformsQ.data) return [];
    return rows.map((row) => mergeImportRowWithDefaults(row, {}, platformsQ.data!));
  }, [rows, platformsQ.data]);

  const handleParsed = (parsed: SiteImportRow[], errors: string[]) => {
    setRows(parsed);
    setParseErrors(errors);
    setResult(null);
    setError(null);
  };

  const handleClear = () => {
    setRows([]);
    setParseErrors([]);
    setResult(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!platformsQ.data || rows.length === 0) return;
    setError(null);
    setResult(null);
    const sites = rows.map((row) => mergeImportRowWithDefaults(row, {}, platformsQ.data!));
    try {
      const res = await bulkCreate.mutateAsync(sites);
      setResult({ created: res.count, failed: res.errors.length });
      if (res.count > 0 && res.errors.length === 0) {
        setRows([]);
        setParseErrors([]);
      }
      if (res.errors.length > 0) {
        setParseErrors(res.errors.map((e) => `${e.domain}: ${e.message}`));
      }
    } catch (err: any) {
      setError(err?.message || "Import failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadText("site-import-template.csv", SITE_IMPORT_CSV_TEMPLATE)}
        >
          <Download className="w-4 h-4 mr-2" />
          Download CSV template
        </Button>
      </div>

      <SiteFileUpload
        label="Import file"
        description="Upload CSV or JSON with per-site domains, tags, and tracking specs. Each row can define its own scan frequency, geo locations, alert emails, tracked platforms, and tag filters."
        onParsed={handleParsed}
        onClear={handleClear}
        testId="input-bulk-import-file"
      />

      {parseErrors.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {parseErrors.slice(0, 8).map((e, i) => (
            <div key={i}>{e}</div>
          ))}
          {parseErrors.length > 8 && <div>…and {parseErrors.length - 8} more</div>}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="space-y-2">
            <Label>Preview ({rows.length} sites)</Label>
            <div className="rounded-md border max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Tags / filter</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 20).map((row) => (
                    <TableRow key={row.domain}>
                      <TableCell className="font-mono text-sm">{row.domain}</TableCell>
                      <TableCell>{row.scanFrequency || "daily"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.tagFilterEnabled
                          ? row.tagFilterMode === "specific"
                            ? `${row.tagFilterPlatformIds?.length ?? 0} filter tags`
                            : row.tagFilterDescription || "description filter"
                          : row.trackedTagPlatformIds?.length
                            ? `${row.trackedTagPlatformIds.length} platforms`
                            : "All tags"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 20 && (
              <p className="text-xs text-muted-foreground">Showing first 20 of {rows.length} sites</p>
            )}
          </div>

          <div className="flex justify-end items-center gap-3">
            {result && (
              <span className="text-sm text-muted-foreground">
                Created {result.created} site{result.created !== 1 ? "s" : ""}
                {result.failed > 0 && `, ${result.failed} failed`}
              </span>
            )}
            <Button
              onClick={handleImport}
              disabled={bulkCreate.isPending || !platformsQ.data}
              data-testid="button-bulk-import"
            >
              {bulkCreate.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import {rows.length} site{rows.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
