import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { parseSiteImportFile, type SiteImportRow } from "@shared/site-import";

interface SiteFileUploadProps {
  label?: string;
  description?: string;
  accept?: string;
  onParsed: (rows: SiteImportRow[], errors: string[], filename: string) => void;
  onClear?: () => void;
  testId?: string;
}

export function SiteFileUpload({
  label = "Upload file",
  description = "Supported: .txt, .csv, .json",
  accept = ".txt,.csv,.json,text/plain,text/csv,application/json",
  onParsed,
  onClear,
  testId = "input-site-file",
}: SiteFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const { rows, errors } = parseSiteImportFile(file.name, text);
    setFilename(file.name);
    onParsed(rows, errors, file.name);
  };

  const clear = () => {
    setFilename(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          data-testid={testId}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Choose file
        </Button>
        {filename && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{filename}</span>
            <button type="button" onClick={clear} className="hover:text-foreground" aria-label="Remove file">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
