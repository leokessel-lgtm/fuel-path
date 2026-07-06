import { useEffect, useRef, useState } from "react";

import { LocationSearchContext, searchLocations } from "../api/fuelPathApi";
import { MapPoint } from "../types";

export function useNearbyLocationSearch(context?: LocationSearchContext) {
  const [locationQuery, setLocationQuery] = useState("");
  const [recentLocations, setRecentLocations] = useState<MapPoint[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<MapPoint[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [locationSearchActive, setLocationSearchActive] = useState(false);
  const [locationError, setLocationError] = useState("");
  const addressSessionTokenRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);
  const contextRef = useRef(context);

  if (!addressSessionTokenRef.current) {
    addressSessionTokenRef.current = makeLocationSessionToken();
  }
  contextRef.current = context;

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const addRecentLocation = (location: MapPoint) => {
    setRecentLocations((current) => {
      const deduped = current.filter((item) => item.label !== location.label);
      return [location, ...deduped].slice(0, 5);
    });
  };

  const clearLocationSearch = () => {
    searchRequestRef.current += 1;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setLocationSuggestions([]);
    setSuggestionsLoading(false);
    setLocationSearchActive(false);
    setLocationError("");
  };

  const getAddressSessionToken = () => addressSessionTokenRef.current || "";

  const resetAddressSessionToken = () => {
    addressSessionTokenRef.current = makeLocationSessionToken();
  };

  const updateLocationQuery = (value: string) => {
    const query = value.trim();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setLocationQuery(value);
    setLocationError("");
    setLocationSearchActive(true);
    if (query.length < 3) {
      setLocationSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    searchTimerRef.current = setTimeout(() => {
      searchLocations(query, 5, getAddressSessionToken(), contextRef.current)
        .then((suggestions) => {
          if (searchRequestRef.current === requestId) setLocationSuggestions(suggestions);
        })
        .catch(() => {
          if (searchRequestRef.current !== requestId) return;
          setLocationSuggestions([]);
          setLocationError("");
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) setSuggestionsLoading(false);
        });
    }, 650);
  };

  return {
    addRecentLocation,
    clearLocationSearch,
    getAddressSessionToken,
    locationError,
    locationQuery,
    locationSearchActive,
    locationSuggestions,
    recentLocations,
    resetAddressSessionToken,
    setLocationError,
    setLocationQuery,
    suggestionsLoading,
    updateLocationQuery,
  };
}

function makeLocationSessionToken() {
  return `nearby-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
