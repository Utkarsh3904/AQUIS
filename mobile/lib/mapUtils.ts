import { colors } from "../theme/colors";
import type { StationListItem, StationFacts } from "../types/station";

export function getStationPinColor(
  station: StationListItem,
  facts: StationFacts | null | undefined
): string {
  if (!station.slug || !facts?.forecast) {
    return colors.mapPinNoForecast;
  }
  const dir = facts.forecast.direction;
  if (dir === "expected decline") return colors.mapPinDecline;
  if (dir === "expected rise" || dir === "stable") return colors.mapPinRise;
  return colors.mapPinNoForecast;
}

export const UP_REGION = {
  latitude: 26.8,
  longitude: 80.5,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};
