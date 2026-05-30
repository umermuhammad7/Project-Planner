import { env, getTravelConfig } from "../env.js";

type TravelReminderInput = {
  locationLat: number | null;
  locationLng: number | null;
  startAt: Date;
};

export async function getTravelReminderRecommendation(input: TravelReminderInput) {
  const config = getTravelConfig();
  if (!config.hasGoogleMapsKey) {
    return {
      supported: false as const,
      reason: "Google Maps Distance Matrix is not configured on this server yet.",
      recommendedLeadMinutes: null,
      estimatedTravelMinutes: null,
      provider: "unavailable" as const
    };
  }

  if (!config.homeCoordinatesConfigured) {
    return {
      supported: false as const,
      reason: "Home travel coordinates are not configured yet, so HomeThread cannot calculate departure time.",
      recommendedLeadMinutes: null,
      estimatedTravelMinutes: null,
      provider: "unavailable" as const
    };
  }

  if (typeof input.locationLat !== "number" || typeof input.locationLng !== "number") {
    return {
      supported: false as const,
      reason: "This event does not have map coordinates yet, so travel time cannot be estimated.",
      recommendedLeadMinutes: null,
      estimatedTravelMinutes: null,
      provider: "unavailable" as const
    };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", `${env.TRAVEL_HOME_LATITUDE},${env.TRAVEL_HOME_LONGITUDE}`);
  url.searchParams.set("destinations", `${input.locationLat},${input.locationLng}`);
  url.searchParams.set("departure_time", `${Math.floor(input.startAt.getTime() / 1000)}`);
  url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY!);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        supported: false as const,
        reason: "Google Maps did not return a travel estimate right now.",
        recommendedLeadMinutes: null,
        estimatedTravelMinutes: null,
        provider: "unavailable" as const
      };
    }

    const payload = (await response.json()) as {
      rows?: Array<{ elements?: Array<{ duration_in_traffic?: { value: number }; duration?: { value: number }; status?: string }> }>;
    };
    const element = payload.rows?.[0]?.elements?.[0];
    const seconds = element?.duration_in_traffic?.value ?? element?.duration?.value;

    if (!seconds || element?.status !== "OK") {
      return {
        supported: false as const,
        reason: "Google Maps could not estimate traffic for this event.",
        recommendedLeadMinutes: null,
        estimatedTravelMinutes: null,
        provider: "unavailable" as const
      };
    }

    const estimatedTravelMinutes = Math.max(5, Math.ceil(seconds / 60));
    return {
      supported: true as const,
      reason: "Travel reminder can be scheduled from the configured home location.",
      recommendedLeadMinutes: estimatedTravelMinutes + 15,
      estimatedTravelMinutes,
      provider: "google_maps" as const
    };
  } catch {
    return {
      supported: false as const,
      reason: "Google Maps travel lookup failed.",
      recommendedLeadMinutes: null,
      estimatedTravelMinutes: null,
      provider: "unavailable" as const
    };
  }
}
