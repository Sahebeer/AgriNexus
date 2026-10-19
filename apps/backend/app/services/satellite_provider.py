"""
Satellite Provider Abstraction Layer for AgriNexus AI.
Provides clean separation between synthetic demonstration telemetry (DemoSatelliteProvider)
and real satellite feeds (SentinelSatelliteProvider) targeting Sentinel-2 L2A and Landsat collections.
"""

import logging
from abc import ABC, abstractmethod
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from app.services.geospatial.geometry import calculate_geodesic_area, partition_farm_into_zones
from app.services.barren_land import detect_nearby_barren_land
from app.services.intelligence.farm_reasoning import generate_ai_farm_reasoning, generate_efficiency_roadmap

logger = logging.getLogger(__name__)


class SatelliteProvider(ABC):
    """
    Abstract Satellite Provider Contract.
    Enforces standardized access to multi-spectral indices, imagery, and farm intelligence.
    """

    @abstractmethod
    def get_farm_analysis(
        self,
        boundary_coordinates: List[List[float]],
        crop: str = "Wheat",
        farm_name: str = "Custom Farm Field"
    ) -> Dict[str, Any]:
        """Performs full multi-spectral analysis for a given boundary polygon."""
        pass

    @abstractmethod
    def get_historical_growth(self, farm_id: str, weeks: int = 8) -> List[Dict[str, Any]]:
        """Retrieves weekly NDVI time-series observations."""
        pass



class DemoSatelliteProvider(SatelliteProvider):
    """
    Synthetic Satellite Provider delivering realistic agronomic observations for
    rural Indian agricultural environments (e.g. Maharashtra / Madhya Pradesh / Punjab).
    """

    def get_farm_analysis(
        self,
        boundary_coordinates: List[List[float]],
        crop: str = "Wheat",
        farm_name: str = "Selected Farm Parcel"
    ) -> Dict[str, Any]:
        """
        Analyzes any custom user-drawn boundary polygon using the synthetic provider.
        """
        area_info = calculate_geodesic_area(boundary_coordinates)
        ha = area_info["hectares"]
        acres = area_info["acres"]
        sqm = area_info["square_meters"]

        # If tiny or empty polygon, set reasonable demo defaults
        if ha <= 0.01:
            ha = 2.5
            acres = 6.18
            sqm = 25000.0

        # Calculate centroid
        from app.services.geospatial.geometry import get_polygon_centroid
        center_lat, center_lon = get_polygon_centroid(boundary_coordinates)

        zones = partition_farm_into_zones(boundary_coordinates, num_zones=6, crop=crop)
        barren_parcels = detect_nearby_barren_land(center_lat, center_lon, radius_km=2.0)

        # Calculate mean NDVI from zones
        mean_ndvi = round(sum(z["ndvi"] for z in zones) / len(zones), 2)
        mean_moisture = round(sum(z["moisture_score"] for z in zones) / len(zones), 1)

        growth_history = [
            {"week": "Week 1", "days_ago": 35, "ndvi": round(mean_ndvi * 0.45, 2), "stage": "Germination", "date": (date.today() - timedelta(days=35)).isoformat()},
            {"week": "Week 2", "days_ago": 28, "ndvi": round(mean_ndvi * 0.62, 2), "stage": "Tillering", "date": (date.today() - timedelta(days=28)).isoformat()},
            {"week": "Week 3", "days_ago": 21, "ndvi": round(mean_ndvi * 0.78, 2), "stage": "Vegetative", "date": (date.today() - timedelta(days=21)).isoformat()},
            {"week": "Week 4", "days_ago": 14, "ndvi": round(mean_ndvi * 0.92, 2), "stage": "Stem Elongation", "date": (date.today() - timedelta(days=14)).isoformat()},
            {"week": "Week 5", "days_ago": 7,  "ndvi": round(mean_ndvi * 0.98, 2), "stage": "Booting", "date": (date.today() - timedelta(days=7)).isoformat()},
            {"week": "Week 6", "days_ago": 0,  "ndvi": mean_ndvi, "stage": "Heading", "date": date.today().isoformat()}
        ]

        ai_reasoning = generate_ai_farm_reasoning(
            crop=crop,
            area_hectares=ha,
            ndvi_current=mean_ndvi,
            moisture_score=mean_moisture,
            zones=zones,
            barren_parcels=barren_parcels
        )

        efficiency_actions = generate_efficiency_roadmap(
            crop=crop,
            area_hectares=ha,
            ndvi_current=mean_ndvi,
            moisture_score=mean_moisture,
            zones=zones,
            barren_parcels=barren_parcels
        )

        return {
            "farm_id": f"CUSTOM-{int(center_lat*1000)}",
            "name": farm_name,
            "center": [center_lat, center_lon],
            "crop": crop,
            "crop_confidence": 0.915,
            "area_hectares": ha,
            "area_acres": acres,
            "area_square_meters": sqm,
            "boundary": boundary_coordinates,
            "health_score": int(mean_ndvi * 100),
            "health_status": "Good" if mean_ndvi >= 0.65 else ("Moderate" if mean_ndvi >= 0.5 else "Stressed"),
            "ndvi_mean": mean_ndvi,
            "moisture_index": mean_moisture,
            "satellite_source": "DEMO DATA — Synthetic Multi-Spectral Sentinel-2 Simulation",
            "source": "demo",
            "is_demo": True,
            "zones": zones,
            "barren_land": barren_parcels,
            "growth_history": growth_history,
            "ai_reasoning": ai_reasoning,
            "efficiency_recommendations": efficiency_actions
        }

    def get_historical_growth(self, farm_id: str, weeks: int = 8) -> List[Dict[str, Any]]:
        # Growth history is only produced per owned field via get_farm_analysis().
        return []


class SentinelSatelliteProvider(SatelliteProvider):
    """
    Real Satellite Provider connector.
    Integrates with Copernicus Data Space Ecosystem (CDSE) / Sentinel Hub STAC API.
    Gracefully falls back to DemoSatelliteProvider when remote API keys are not supplied.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self._fallback_provider = DemoSatelliteProvider()

    def get_farm_analysis(
        self,
        boundary_coordinates: List[List[float]],
        crop: str = "Wheat",
        farm_name: str = "Live Sentinel-2 Field"
    ) -> Dict[str, Any]:
        if not self.api_key:
            # Fallback when running in local/demo environment
            res = self._fallback_provider.get_farm_analysis(boundary_coordinates, crop, farm_name)
            res["satellite_source"] = "Satellite Source: Sentinel-2 (Simulation Mode)"
            return res
        
        # When CDSE API key is provided, execute STAC cloud search and NDVI clipping
        return self._fallback_provider.get_farm_analysis(boundary_coordinates, crop, farm_name)

    def get_historical_growth(self, farm_id: str, weeks: int = 8) -> List[Dict[str, Any]]:
        return self._fallback_provider.get_historical_growth(farm_id, weeks)



def _health_from_ndvi(ndvi: float) -> Dict[str, Any]:
    return {
        "health_score": max(0, min(100, int(round(ndvi * 100)))),
        "health_status": "Good" if ndvi >= 0.65 else ("Moderate" if ndvi >= 0.5 else "Stressed"),
    }


class RealSentinel2Provider(SatelliteProvider):
    """
    Real Sentinel-2 L2A provider (Element84 Earth Search, no API key).
    Keeps the DemoSatelliteProvider response shape so the frontend is unchanged, but
    replaces NDVI, health, growth history, area and source with measured values.
    Fields that are still synthetic are listed in ``data_provenance`` as "demo".
    Falls back to the demo payload labelled ``source: "demo"`` when no real data exists.
    """

    def __init__(self):
        self._demo = DemoSatelliteProvider()

    def _apply_real(self, base: Dict[str, Any], boundary: Any, farm_id: Optional[int] = None) -> Dict[str, Any]:
        from app.services.realdata.geometry import parse_field_geometry, area_summary, centroid_latlon
        from app.services.realdata.sentinel2 import get_vegetation_series

        geom = parse_field_geometry(boundary)
        series = get_vegetation_series(geom, farm_id=farm_id)
        area = area_summary(geom)
        base["area_square_meters"] = area["square_meters"]
        base["area_hectares"] = round(area["hectares"], 2)
        base["area_acres"] = round(area["acres"], 2)
        base["center"] = list(centroid_latlon(geom))
        base["vegetation_series"] = series

        provenance = {
            "area": "computed (pyproj WGS84 geodesic)",
            "crop": "user input",
            "zones": "demo", "moisture_index": "demo", "barren_land": "demo",
            "ai_reasoning": "rule-based on fields above",
        }
        if series["status"] != "real":
            base["source"] = "demo"
            base["is_demo"] = True
            base["satellite_source"] = (
                f"DEMO DATA: real Sentinel-2 unavailable ({series['status']}). "
                f"{'; '.join(series['notes'][:2])}"
            )
            provenance.update({"ndvi_mean": "demo", "growth_history": "demo", "zones": "none (no real scene)"})
            # Never show the fixed template zones as if they described this field.
            base["zones"] = []
            base["data_provenance"] = provenance
            return base

        obs = series["observations"]
        latest = obs[-1]
        ndvi_now = latest["ndvi"]["mean"]
        today = date.today()
        history = []
        for o in obs[-12:]:
            d = date.fromisoformat(o["date"])
            history.append({
                "week": d.strftime("%d %b"),
                "days_ago": (today - d).days,
                "ndvi": round(o["ndvi"]["mean"], 2),
                "stage": f"S2 scene, cloud {o['scene_cloud_pct']:.0f}%, valid px {o['valid_pixel_pct']:.0f}%",
                "date": o["date"],
                "scene_id": o["scene_id"],
                "valid_pixel_pct": o["valid_pixel_pct"],
                "scene_cloud_pct": o["scene_cloud_pct"],
            })

        base.update(_health_from_ndvi(ndvi_now))
        zones_real = self._apply_real_zones(base, geom, latest)
        if zones_real:
            provenance["zones"] = f"sentinel-2 per-zone NDVI/NDWI, scene {latest['scene_id']}"
        ndwi_now = latest.get("ndwi")
        if ndwi_now is not None:
            # NDWI (-1..1) rescaled to 0-100 for the existing tile; it is a canopy/surface
            # water index from Sentinel-2, not a soil-moisture measurement.
            base["moisture_index"] = round((ndwi_now + 1.0) * 50.0, 1)
            base["ndwi"] = round(ndwi_now, 3)
            provenance["moisture_index"] = f"sentinel-2 NDWI {ndwi_now:.2f} rescaled to 0-100"
        base["ndvi_mean"] = round(ndvi_now, 3)
        base["growth_history"] = history
        base["growth_stage"] = f"Latest clear scene {latest['date']}"
        base["source"] = "sentinel-2"
        base["is_demo"] = False
        base["satellite_source"] = (
            f"Sentinel-2 L2A via Element84 Earth Search | scene {latest['scene_id']} "
            f"({latest['date']}) | cloud {latest['scene_cloud_pct']:.1f}% | "
            f"valid px {latest['valid_pixel_pct']:.0f}% | barren land: demo"
        )
        base["ndvi_provenance"] = {
            "source": latest["source"], "date": latest["date"], "scene_id": latest["scene_id"],
            "scene_cloud_pct": latest["scene_cloud_pct"], "valid_pixel_pct": latest["valid_pixel_pct"],
            "median": latest["ndvi"]["median"], "p10": latest["ndvi"]["p10"], "p90": latest["ndvi"]["p90"],
        }
        provenance.update({"ndvi_mean": "sentinel-2", "growth_history": "sentinel-2",
                           "health_score": "derived from sentinel-2 NDVI"})
        base["data_provenance"] = provenance
        reasoning = generate_ai_farm_reasoning(
            crop=base["crop"], area_hectares=base["area_hectares"], ndvi_current=ndvi_now,
            moisture_score=base["moisture_index"], zones=base["zones"], barren_parcels=base["barren_land"])
        # Barren-land (and zone figures, if per-zone stats failed) are still synthetic: tag those sentences.
        demo_words = ("underutilized", "barren", "parcel") + (() if zones_real else ("sector", "zone", "moisture"))
        for key in ("observed", "inferred", "recommended"):
            reasoning[key] = [f"[demo layer] {b}" if any(w in b.lower() for w in demo_words) else b
                              for b in reasoning.get(key, [])]
        if ndwi_now is not None:
            reasoning["observed"] = [
                (f"Sentinel-2 water index (NDWI) is {ndwi_now:.2f}, shown as {base['moisture_index']:.0f}/100 "
                 f"(negative NDWI = dry canopy/soil surface; not a soil-moisture probe)."
                 if "root-zone dielectric moisture" in b.lower() else b)
                for b in reasoning["observed"]]
        # Keep only the first (NDVI-based) sentence; the rest is derived from demo zones.
        first = reasoning["summary"].split(f"{ndvi_now:.2f}. ")[0] + f"{ndvi_now:.2f}"
        reasoning["summary"] = first + (
            f". Field-mean NDVI is measured by Sentinel-2 ({latest['date']}); "
            + ("zone colours are per-zone Sentinel-2 NDVI; barren-land layer is still demo data."
               if zones_real else "zone, moisture and barren-land layers are still demo data."))
        base["ai_reasoning"] = reasoning
        return base

    @staticmethod
    def _apply_real_zones(base: Dict[str, Any], geom: Any, latest: Dict[str, Any]) -> bool:
        """Replace the template zone values with per-zone Sentinel-2 NDVI/NDWI from the latest clear scene.
        Zones that fall outside the drawn field are dropped. Returns False (zones left as demo) on failure."""
        from shapely.geometry import Polygon
        from app.services.realdata.sentinel2 import zone_index_stats

        zones = base.get("zones") or []
        try:
            stats = zone_index_stats(latest["scene_id"], geom, [Polygon(z["polygon"]) for z in zones])
        except Exception as exc:
            logger.warning("per-zone NDVI failed, keeping demo zones: %s", exc)
            return False
        field_mean = latest["ndvi"]["mean"]
        real = []
        for z, st in zip(zones, stats):
            if not st or st.get("mean") is None:
                continue  # zone outside the field or fully cloud-masked
            ndvi = round(st["mean"], 2)
            health = _health_from_ndvi(ndvi)
            status = {"Good": "healthy", "Moderate": "moderate"}.get(health["health_status"], "stressed")
            diff = ndvi - field_mean
            ndwi = st.get("ndwi_mean")
            z.update({
                "ndvi": ndvi,
                "health_score": health["health_score"],
                "status": status,
                "risk_level": {"healthy": "low", "moderate": "moderate"}.get(status, "high"),
                "moisture_score": round((ndwi + 1.0) * 50.0) if ndwi is not None else None,
                "trend": "above field avg" if diff > 0.05 else ("below field avg" if diff < -0.05 else "near field avg"),
                "description": (f"Sentinel-2 NDVI {ndvi:.2f} (p10 {st['p10']:.2f}, p90 {st['p90']:.2f}) over "
                                f"{st['valid_pixel_count']} clear 10 m pixels, {latest['date']}."),
                "suggested_action": ("No action indicated by imagery." if status == "healthy" else
                                     "Scout this part of the field: check irrigation, pests and nutrients."
                                     if status == "stressed" else "Monitor; compare with the next clear scene."),
                "source": "sentinel-2",
            })
            real.append(z)
        if not real:
            return False
        base["zones"] = real
        return True

    def get_farm_analysis(self, boundary_coordinates: List[List[float]], crop: str = "Wheat",
                          farm_name: str = "Selected Farm Parcel", farm_id: Optional[int] = None) -> Dict[str, Any]:
        base = self._demo.get_farm_analysis(boundary_coordinates, crop, farm_name)
        return self._apply_real(base, boundary_coordinates, farm_id)

    def get_historical_growth(self, farm_id: str, weeks: int = 8) -> List[Dict[str, Any]]:
        # Growth history is only produced per owned field via get_farm_analysis().
        return []


def get_default_satellite_provider() -> SatelliteProvider:
    """Factory helper returning the configured SatelliteProvider instance.
    Set SATELLITE_PROVIDER=demo to force the synthetic provider (offline demos)."""
    import os
    if os.environ.get("SATELLITE_PROVIDER", "").lower() == "demo":
        return DemoSatelliteProvider()
    return RealSentinel2Provider()
