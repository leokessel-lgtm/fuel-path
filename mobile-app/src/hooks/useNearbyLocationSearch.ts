import { useEffect, useRef, useState } from "react";

import { searchLocations } from "../api/fuelPathApi";
import { MapPoint } from "../types";

export function useNearbyLocationSearch() {
  const [locationQuery, setLocationQuery] = useState("");
  const [recentLocations, setRecentLocations] = useState<MapPoint[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<MapPoint[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [locationSearchActive, setLocationSearchActive] = useState(false);
  const [locationError, setLocationError] = useState("");
  const addressSessionTokenRef = useRef(makeLocationSessionToken());

  useEffect(() => {
    if (!locationSearchActive) return;
    const query = locationQuery.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let active = true;
    setSuggestionsLoading(true);
    setLocationError("");
    const timer = setTimeout(() => {
      searchLocations(query, 5, addressSessionTokenRef.current)
        .then((suggestions) => {
          if (active) setLocationSuggestions(suggestions);
        })
        .catch(() => {
          if (!active) return;
          setLocationSuggestions([]);
          setLocationError("");
        })
        .finally(() => {
          if (active) setSuggestionsLoading(false);
        });
    }, 650);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locationQuery, locationSearchActive]);

  const addRecentLocation = (location: MapPoint) => {
    setRecentLocations((current) => {
      const deduped = current.filter((item) => item.label !== location.label);
      return [location, ...deduped].slice(0, 5);
    });
  };

  const clearLocationSearch = () => {
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setLocationError("");
  };

  const getAddressSessionToken = () => addressSessionTokenRef.current;

  const resetAddressSessionToken = () => {
    addressSessionTokenRef.current = makeLocationSessionToken();
  };

  const updateLocationQuery = (value: string) => {
    setLocationQuery(value);
    setLocationError("");
    setLocationSearchActive(true);
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
