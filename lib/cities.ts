export interface CityConfig {
  id: string;
  label: string;
  fullName: string;
  center: { lat: number; lng: number };
  mapZoom: number;
}

export const CITIES: Record<string, CityConfig> = {
  atlanta:      { id: "atlanta",      label: "Atlanta",        fullName: "Atlanta, GA",           center: { lat: 33.7490,  lng: -84.3880  }, mapZoom: 13 },
  austin:       { id: "austin",       label: "Austin",         fullName: "Austin, TX",             center: { lat: 30.2672,  lng: -97.7431  }, mapZoom: 13 },
  boston:       { id: "boston",       label: "Boston",         fullName: "Boston, MA",             center: { lat: 42.3601,  lng: -71.0589  }, mapZoom: 13 },
  charlotte:    { id: "charlotte",    label: "Charlotte",      fullName: "Charlotte, NC",          center: { lat: 35.2271,  lng: -80.8431  }, mapZoom: 13 },
  chicago:      { id: "chicago",      label: "Chicago",        fullName: "Chicago, IL",            center: { lat: 41.8781,  lng: -87.6298  }, mapZoom: 13 },
  dallas:       { id: "dallas",       label: "Dallas",         fullName: "Dallas, TX",             center: { lat: 32.7767,  lng: -96.7970  }, mapZoom: 13 },
  denver:       { id: "denver",       label: "Denver",         fullName: "Denver, CO",             center: { lat: 39.7392,  lng: -104.9903 }, mapZoom: 13 },
  detroit:      { id: "detroit",      label: "Detroit",        fullName: "Detroit, MI",            center: { lat: 42.3314,  lng: -83.0458  }, mapZoom: 13 },
  houston:      { id: "houston",      label: "Houston",        fullName: "Houston, TX",            center: { lat: 29.7604,  lng: -95.3698  }, mapZoom: 13 },
  lasvegas:     { id: "lasvegas",     label: "Las Vegas",      fullName: "Las Vegas, NV",          center: { lat: 36.1699,  lng: -115.1398 }, mapZoom: 13 },
  losangeles:   { id: "losangeles",   label: "Los Angeles",    fullName: "Los Angeles, CA",        center: { lat: 34.0522,  lng: -118.2437 }, mapZoom: 12 },
  miami:        { id: "miami",        label: "Miami",          fullName: "Miami, FL",              center: { lat: 25.7617,  lng: -80.1918  }, mapZoom: 13 },
  minneapolis:  { id: "minneapolis",  label: "Minneapolis",    fullName: "Minneapolis, MN",        center: { lat: 44.9778,  lng: -93.2650  }, mapZoom: 13 },
  nashville:    { id: "nashville",    label: "Nashville",      fullName: "Nashville, TN",          center: { lat: 36.1627,  lng: -86.7816  }, mapZoom: 13 },
  neworleans:   { id: "neworleans",   label: "New Orleans",    fullName: "New Orleans, LA",        center: { lat: 29.9511,  lng: -90.0715  }, mapZoom: 14 },
  newyork:      { id: "newyork",      label: "New York",       fullName: "New York City, NY",      center: { lat: 40.7128,  lng: -74.0060  }, mapZoom: 13 },
  philadelphia: { id: "philadelphia", label: "Philadelphia",   fullName: "Philadelphia, PA",       center: { lat: 39.9526,  lng: -75.1652  }, mapZoom: 13 },
  phoenix:      { id: "phoenix",      label: "Phoenix",        fullName: "Phoenix, AZ",            center: { lat: 33.4484,  lng: -112.0740 }, mapZoom: 12 },
  portland:     { id: "portland",     label: "Portland",       fullName: "Portland, OR",           center: { lat: 45.5051,  lng: -122.6750 }, mapZoom: 13 },
  raleigh:      { id: "raleigh",      label: "Raleigh",        fullName: "Raleigh, NC",            center: { lat: 35.7796,  lng: -78.6382  }, mapZoom: 13 },
  sandiego:     { id: "sandiego",     label: "San Diego",      fullName: "San Diego, CA",          center: { lat: 32.7157,  lng: -117.1611 }, mapZoom: 13 },
  sf:           { id: "sf",           label: "San Francisco",  fullName: "San Francisco, CA",      center: { lat: 37.7749,  lng: -122.4194 }, mapZoom: 13 },
  sanjose:      { id: "sanjose",      label: "San Jose",       fullName: "San Jose, CA",           center: { lat: 37.3382,  lng: -121.8863 }, mapZoom: 13 },
  seattle:      { id: "seattle",      label: "Seattle",        fullName: "Seattle, WA",            center: { lat: 47.6062,  lng: -122.3321 }, mapZoom: 13 },
  stlouis:      { id: "stlouis",      label: "St. Louis",      fullName: "St. Louis, MO",          center: { lat: 38.6270,  lng: -90.1994  }, mapZoom: 13 },
  tampa:        { id: "tampa",        label: "Tampa",          fullName: "Tampa, FL",              center: { lat: 27.9506,  lng: -82.4572  }, mapZoom: 13 },
  dc:           { id: "dc",           label: "Washington DC",  fullName: "Washington, DC",         center: { lat: 38.9072,  lng: -77.0369  }, mapZoom: 13 },
};

export const CITIES_SORTED = Object.values(CITIES).sort((a, b) =>
  a.label.localeCompare(b.label)
);

export const DEFAULT_CITY = "nashville";
