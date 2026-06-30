import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCAN_FREQUENCIES } from "@shared/scan-frequency";

interface ScanFrequencySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  testId?: string;
}

export function ScanFrequencySelect({
  value,
  onValueChange,
  id,
  testId,
}: ScanFrequencySelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCAN_FREQUENCIES.map((freq) => (
          <SelectItem key={freq.value} value={freq.value}>
            {freq.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
