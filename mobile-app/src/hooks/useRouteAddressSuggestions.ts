import { useEffect, useRef, useState } from "react";

import { LocationSearchContext, searchLocations } from "../api/fuelPathApi";
import { MapPoint } from "../types";

type RouteAddressField = "from" | "to";

export function useRouteAddressSuggestions({
  from,
  fromContext,
  to,
  toContext,
}: {
  from: string;
  fromContext?: LocationSearchContext;
  to: string;
  toContext?: LocationSearchContext;
}) {
  const [activeAddressField, setActiveAddressField] = useState<RouteAddressField | null>(null);
  const [fromSuggestions, setFromSuggestions] = useState<MapPoint[]>([]);
  const [toSuggestions, setToSuggestions] = useState<MapPoint[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<RouteAddressField | null>(null);
  const [suggestionsError, setSuggestionsError] = useState("");
  const addressSessionTokensRef = useRef({
    from: makeLocationSessionToken(),
    to: makeLocationSessionToken(),
  });

  useEffect(() => {
    const field = activeAddressField;
    if (!field) return;

    const query = (field === "from" ? from : to).trim();
    if (query.length < 3) {
      clearAddressSuggestions(field);
      setSuggestionsLoading(null);
      setSuggestionsError("");
      return;
    }

    let active = true;
    setSuggestionsLoading(field);
    setSuggestionsError("");
    const timer = setTimeout(() => {
      searchLocations(
        query,
        5,
        addressSessionTokensRef.current[field],
        field === "from" ? fromContext : toContext,
      )
        .then((suggestions) => {
          if (!active) return;
          setAddressSuggestions(field, suggestions);
        })
        .catch(() => {
          if (!active) return;
          setAddressSuggestions(field, []);
          setSuggestionsError("");
        })
        .finally(() => {
          if (active) setSuggestionsLoading(null);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    activeAddressField,
    from,
    fromContext?.near?.lat,
    fromContext?.near?.lon,
    fromContext?.nearRadiusKm,
    to,
    toContext?.near?.lat,
    toContext?.near?.lon,
    toContext?.nearRadiusKm,
  ]);

  const clearAddressSuggestionError = () => setSuggestionsError("");

  const clearAddressSuggestions = (field: RouteAddressField) => {
    setAddressSuggestions(field, []);
  };

  const getAddressSessionToken = (field: RouteAddressField) =>
    addressSessionTokensRef.current[field];

  const resetAddressSessionToken = (field: RouteAddressField) => {
    addressSessionTokensRef.current[field] = makeLocationSessionToken();
  };

  function setAddressSuggestions(field: RouteAddressField, suggestions: MapPoint[]) {
    if (field === "from") {
      setFromSuggestions(suggestions);
      return;
    }
    setToSuggestions(suggestions);
  }

  return {
    activeAddressField,
    clearAddressSuggestionError,
    clearAddressSuggestions,
    fromSuggestions,
    getAddressSessionToken,
    resetAddressSessionToken,
    setActiveAddressField,
    suggestionsError,
    suggestionsLoading,
    toSuggestions,
  };
}

function makeLocationSessionToken() {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
