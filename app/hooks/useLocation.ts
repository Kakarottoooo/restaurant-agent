import { useState, useEffect, useRef } from "react";
import { CITIES, DEFAULT_CITY } from "@/lib/cities";

export function useLocation() {
  const [cityId, setCityId] = useState(DEFAULT_CITY);
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isNearMe, setIsNearMe] = useState(false);
  const [nearLocation, setNearLocation] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [supportsGps, setSupportsGps] = useState(false);

  // Refs for blur-suppression logic in the location dropdown
  const locationInputRef = useRef("");
  const locationSuppressBlur = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupportsGps("geolocation" in navigator);
  }, []);

  const city = CITIES[cityId];

  function handleCitySelect(id: string) {
    setCityId(id);
    setNearLocation("");
    setGpsCoords(null);
    setIsNearMe(false);
  }

  function submitNearLocation(value: string) {
    setNearLocation(value);
    setGpsCoords(null);
    setIsNearMe(false);
  }

  function updateLocationInput(val: string) {
    locationInputRef.current = val;
    setLocationInput(val);
  }

  function requestGps() {
    setGpsError(null);
    setNearLocation("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsNearMe(true);
      },
      () => {
        setGpsError(
          "Unable to get your location. Please select a city manually."
        );
        setTimeout(() => setGpsError(null), 4000);
      },
      { timeout: 5000 }
    );
  }

  function suppressNextBlur() {
    locationSuppressBlur.current = true;
  }

  function handleLocationBlur() {
    setTimeout(() => {
      if (locationSuppressBlur.current) {
        locationSuppressBlur.current = false;
        return;
      }
      const val = locationInputRef.current.trim();
      if (val) submitNearLocation(val);
      setLocationOpen(false);
      updateLocationInput("");
    }, 0);
  }

  const cityLabel =
    isNearMe ? "Nearby" : nearLocation || (city?.label ?? "");
  const locationDisplayValue =
    isNearMe ? "◎ Near Me" : nearLocation || (city?.label ?? "");
  const mapCenter =
    isNearMe && gpsCoords ? gpsCoords : city?.center;

  return {
    cityId,
    gpsCoords,
    isNearMe,
    nearLocation,
    locationInput,
    locationOpen,
    gpsError,
    supportsGps,
    cityLabel,
    locationDisplayValue,
    mapCenter,
    handleCitySelect,
    submitNearLocation,
    updateLocationInput,
    requestGps,
    setLocationOpen,
    suppressNextBlur,
    handleLocationBlur,
    locationInputRef,
  };
}
