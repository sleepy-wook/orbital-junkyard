export interface SpaceObject {
  norad_cat_id: number;
  object_name: string;
  object_type: string;
  country: string;
  orbital_regime: string;
  inclination: number;
  eccentricity: number;
  mean_motion: number;
  ra_of_asc_node: number;
  arg_of_pericenter: number;
  mean_anomaly: number;
  epoch: string;
  perigee: number;
  apogee: number;
  period: number;
  rcs_size: string;
  object_category: string;
}

export interface OrbitalCensus {
  object_type: string;
  orbital_regime: string;
  country: string;
  object_count: number;
  active_count: number;
  debris_count: number;
  avg_apogee_km: number;
  avg_perigee_km: number;
  snapshot_date: string;
}

export interface CongestionMetric {
  altitude_band_km: number;
  total_objects: number;
  debris_count: number;
  active_count: number;
  avg_eccentricity: number;
  avg_inclination: number;
  debris_ratio: number;
  congestion_level: string;
}

export interface CountryLeaderboard {
  country: string;
  total_objects: number;
  payload_count: number;
  active_count: number;
  debris_count: number;
  rocket_body_count: number;
  debris_ratio: number;
  active_ratio: number;
}

export interface ConstellationGrowth {
  constellation: string;
  total_objects: number;
  active_count: number;
  debris_count: number;
  avg_altitude_km: number;
  first_launch: string;
  latest_launch: string;
}

export interface DecayTracker {
  norad_cat_id: number;
  object_name: string;
  object_type: string;
  country: string;
  apogee_km: number;
  perigee_km: number;
  inclination: number;
  bstar: number;
  epoch: string;
  launch_date: string;
  orbital_regime: string;
  decay_risk: string;
}

export interface StormImpact {
  storm_level: string;
  hours_count: number;
  avg_solar_wind_speed: number;
  max_solar_wind_speed: number;
  avg_solar_wind_density: number;
  avg_xray_flux: number;
}

export interface ExportMetadata {
  exported_at: string;
  tables: string[];
  endpoints: Record<string, string>;
  total_rows: number;
}

export interface TableExport<T> {
  table: string;
  exported_at: string;
  row_count: number;
  data: T[];
}
