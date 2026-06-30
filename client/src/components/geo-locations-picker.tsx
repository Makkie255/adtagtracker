import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GEO_LOCATIONS,
  formatLocationId,
  getAllLocationIds,
  type GeoLocation,
} from "@/lib/geo-locations";

const ALL_LOCATION_IDS = getAllLocationIds();

function filterGeoLocations(query: string): GeoLocation[] {
  const q = query.trim().toLowerCase();
  if (!q) return GEO_LOCATIONS;

  return GEO_LOCATIONS.flatMap((geo) => {
    const countryMatch = geo.country.toLowerCase().includes(q);
    if (countryMatch) return [geo];

    const matchingRegions = geo.regions.filter((region) => region.toLowerCase().includes(q));
    if (matchingRegions.length === 0) return [];

    return [{ country: geo.country, regions: matchingRegions }];
  });
}

interface GeoLocationsPickerProps {
  selectedLocations: string[];
  onSelectedLocationsChange: (locations: string[]) => void;
}

export function GeoLocationsPicker({
  selectedLocations,
  onSelectedLocationsChange,
}: GeoLocationsPickerProps) {
  const [search, setSearch] = useState("");
  const [openCountries, setOpenCountries] = useState<string[]>([]);

  const filteredLocations = useMemo(() => filterGeoLocations(search), [search]);

  useEffect(() => {
    if (search.trim()) {
      setOpenCountries(filteredLocations.map((g) => g.country));
    } else {
      setOpenCountries([]);
    }
  }, [search, filteredLocations]);

  const allSelected = selectedLocations.length === ALL_LOCATION_IDS.length;
  const someSelected = selectedLocations.length > 0 && !allSelected;

  const selectAllState = allSelected ? true : someSelected ? ("indeterminate" as const) : false;

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    onSelectedLocationsChange(checked === true ? ALL_LOCATION_IDS : []);
  };

  const handleLocationToggle = (locationId: string) => {
    onSelectedLocationsChange(
      selectedLocations.includes(locationId)
        ? selectedLocations.filter((l) => l !== locationId)
        : [...selectedLocations, locationId],
    );
  };

  const handleCountrySelectAll = (geo: GeoLocation, checked: boolean) => {
    const ids = geo.regions.map((region) => formatLocationId(geo.country, region));
    if (checked) {
      onSelectedLocationsChange([...new Set([...selectedLocations, ...ids])]);
    } else {
      const idSet = new Set(ids);
      onSelectedLocationsChange(selectedLocations.filter((id) => !idSet.has(id)));
    }
  };

  const getCountrySelectionState = (geo: GeoLocation) => {
    const ids = geo.regions.map((region) => formatLocationId(geo.country, region));
    const selectedCount = ids.filter((id) => selectedLocations.includes(id)).length;
    if (selectedCount === 0) return { checked: false as const, selectedCount };
    if (selectedCount === ids.length) return { checked: true as const, selectedCount };
    return { checked: "indeterminate" as const, selectedCount };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <Label>Geo Locations *</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all-locations"
            checked={selectAllState}
            onCheckedChange={handleSelectAll}
            data-testid="checkbox-select-all-locations"
          />
          <Label htmlFor="select-all-locations" className="font-normal text-sm cursor-pointer">
            Select all
          </Label>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Select countries and regions to scan from ({selectedLocations.length} of{" "}
        {ALL_LOCATION_IDS.length} selected)
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search countries or regions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-geo-search"
        />
      </div>

      <div className="max-h-96 overflow-y-auto rounded-md border px-4">
        {filteredLocations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No countries or regions match &quot;{search}&quot;
          </p>
        ) : (
          <Accordion
            type="multiple"
            value={openCountries}
            onValueChange={setOpenCountries}
            className="w-full"
          >
            {filteredLocations.map((geo) => {
              const { checked, selectedCount } = getCountrySelectionState(geo);
              return (
                <AccordionItem key={geo.country} value={geo.country} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`country-${geo.country}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        handleCountrySelectAll(geo, value === true)
                      }
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-country-${geo.country.toLowerCase()}`}
                    />
                    <AccordionTrigger className="flex-1 py-3 text-sm hover:no-underline">
                      <span className="flex flex-1 items-center justify-between pr-2">
                        <span>{geo.country}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {selectedCount}/{geo.regions.length} selected
                        </span>
                      </span>
                    </AccordionTrigger>
                  </div>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-2 pb-3 pl-6">
                      {geo.regions.map((region) => {
                        const locationId = formatLocationId(geo.country, region);
                        return (
                          <div key={region} className="flex items-center space-x-2">
                            <Checkbox
                              id={locationId}
                              checked={selectedLocations.includes(locationId)}
                              onCheckedChange={() => handleLocationToggle(locationId)}
                              data-testid={`checkbox-${locationId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                            />
                            <Label
                              htmlFor={locationId}
                              className="font-normal text-sm cursor-pointer"
                            >
                              {region}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
