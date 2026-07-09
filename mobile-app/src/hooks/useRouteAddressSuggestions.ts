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
  const activeAddressFieldRef = useRef<RouteAddressField | null>(null);
  const latestInputsRef = useRef({ from, fromContext, to, toContext });
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  latestInputsRef.current = { from, fromContext, to, toContext };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const clearAddressSuggestionError = () => setSuggestionsError("");

  const clearAddressSuggestions = (field: RouteAddressField) => {
    searchRequestRef.current += 1;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setAddressSuggestions(field, []);
    setSuggestionsLoading(null);
  };

  const resetAddressSessionToken = (field: RouteAddressField) => {
    addressSessionTokensRef.current[field] = makeLocationSessionToken();
  };

  const setAddressSessionField = (field: RouteAddressField | null, options?: { search?: boolean }) => {
    if (field && activeAddressFieldRef.current !== field) {
      resetAddressSessionToken(field);
    }
    activeAddressFieldRef.current = field;
    setActiveAddressField(field);
    if (field && options?.search !== false) {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        queueAddressSearch(field);
      }, 0);
    }
    else {
      searchRequestRef.current += 1;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      setSuggestionsLoading(null);
    }
  };

  const getAddressSessionToken = (field: RouteAddressField) => addressSessionTokensRef.current[field] || "";

  function queueAddressSearch(field: RouteAddressField, queryOverride?: string) {
    const { from: latestFrom, fromContext: latestFromContext, to: latestTo, toContext: latestToContext } = latestInputsRef.current;
    const query = (queryOverride ?? (field === "from" ? latestFrom : latestTo)).trim();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 3) {
      setAddressSuggestions(field, []);
      setSuggestionsLoading(null);
      setSuggestionsError("");
      return;
    }
    setSuggestionsLoading(field);
    setSuggestionsError("");
    searchTimerRef.current = setTimeout(() => {
      searchLocations(
        query,
        5,
        addressSessionTokensRef.current[field] || "",
        { ...(field === "from" ? latestFromContext : latestToContext), purpose: "plan_autocomplete" },
      )
        .then((suggestions) => {
          if (searchRequestRef.current === requestId) setAddressSuggestions(field, suggestions);
        })
        .catch(() => {
          if (searchRequestRef.current !== requestId) return;
          setAddressSuggestions(field, []);
          setSuggestionsError("Location suggestions are not available right now. Type a fuller address, suburb or postcode.");
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) setSuggestionsLoading(null);
        });
    }, 350);
  }

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
    setActiveAddressField: setAddressSessionField,
    suggestionsError,
    suggestionsLoading,
    toSuggestions,
  };
}

function makeLocationSessionToken() {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
