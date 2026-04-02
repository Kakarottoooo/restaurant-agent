export interface BookingProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface RestaurantAutopilotRequest {
  restaurant_name: string;
  city: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM (24h)
  covers: number;
  user_profile?: BookingProfile;
}

export interface HotelAutopilotRequest {
  hotel_name: string;
  city: string;
  checkin: string;  // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  adults: number;
  user_profile?: BookingProfile;
}

export type AutopilotStatus =
  | "ready"           // screenshot taken, handoff_url works
  | "no_availability" // no slots found near requested time
  | "error";          // Playwright failed

export interface AutopilotResult {
  status: AutopilotStatus;
  screenshot_base64?: string;  // PNG as base64 data URL
  handoff_url: string;         // URL user opens to complete booking
  selected_time?: string;      // actual slot selected (may differ from requested)
  error?: string;
}
