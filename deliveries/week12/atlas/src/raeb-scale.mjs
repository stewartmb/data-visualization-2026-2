// Local Mercator scale at the center latitude of the subway network.
export const REFERENCE_LATITUDE = 40.7;
export function metersPerRadian(latitude=REFERENCE_LATITUDE) {
  return 6_371_008.8 * Math.cos(latitude * Math.PI / 180);
}
export const METERS_PER_RADIAN = metersPerRadian();

export function metersPerProjectedPixel(projection,latitude=REFERENCE_LATITUDE) {
  return metersPerRadian(latitude)/projection.scale();
}
