import { Plane, Car, Train, Bus, Footprints, Bike, Ship } from 'lucide-react';

// Transport mode icon mapping
const TRANSPORT_ICONS = {
  plane: Plane,
  flight: Plane,
  car: Car,
  driving: Car,
  train: Train,
  bus: Bus,
  walk: Footprints,
  walking: Footprints,
  bike: Bike,
  cycling: Bike,
  ferry: Ship,
};

// Helper function to get transport icon for a destination arrival/departure
export const getTransportIcon = (segments, destinationId, isArrival) => {
  if (!segments || segments.length === 0) return Plane;

  const segment = isArrival
    ? segments.find(s => s.to_destination_id === destinationId)
    : segments.find(s => s.from_destination_id === destinationId);

  if (segment?.travel_mode) {
    return TRANSPORT_ICONS[segment.travel_mode] || Plane;
  }

  return Plane;
};
