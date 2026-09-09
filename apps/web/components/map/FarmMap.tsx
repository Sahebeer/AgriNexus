"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { BaseMapStyle } from "./LayerControl";
import { MapLayerId } from "./MapLegend";
import { FarmZone, BarrenParcel, FarmIntelligenceData } from "../farm/FarmAnalysisPanel";

interface FarmMapProps {
  baseStyle: BaseMapStyle;
  activeLayer: MapLayerId;
  showZones: boolean;
  farmData: FarmIntelligenceData | null;
  selectedZone: FarmZone | null;
  onSelectZone: (zone: FarmZone | null) => void;
  selectedBarrenParcel: BarrenParcel | null;
  onSelectBarrenParcel: (parcel: BarrenParcel | null) => void;
  isDrawing: boolean;
  drawnVertices: [number, number][];
  onAddVertex: (lat: number, lon: number) => void;
  onCompletePolygon: () => void;
  customPolygon: [number, number][] | null;
  center: [number, number];
  zoom: number;
  onMapCenterChange?: (center: [number, number], zoom: number) => void;
}

export default function FarmMap({
  baseStyle,
  activeLayer,
  showZones,
  farmData,
  selectedZone,
  onSelectZone,
  selectedBarrenParcel,
  onSelectBarrenParcel,
  isDrawing,
  drawnVertices,
  onAddVertex,
  onCompletePolygon,
  customPolygon,
  center,
  zoom
}: FarmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);
  const drawingGroupRef = useRef<any>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: zoom,
          zoomControl: false,
          attributionControl: false
        });

        layersGroupRef.current = L.featureGroup().addTo(map);
        drawingGroupRef.current = L.featureGroup().addTo(map);

        map.on("click", (e: any) => {
          if ((window as any).__isDrawingActive) {
            const { lat, lng } = e.latlng;
            (window as any).__onAddVertexCallback?.(lat, lng);
          }
        });

        mapInstanceRef.current = map;
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Global Window Callbacks for drawing events
  useEffect(() => {
    (window as any).__isDrawingActive = isDrawing;
    (window as any).__onAddVertexCallback = onAddVertex;
  }, [isDrawing, onAddVertex]);

  // Update Base Map Tiles
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const updateTiles = async () => {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      let tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      let maxZoom = 19;

      if (baseStyle === "standard") {
        tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      } else if (baseStyle === "terrain") {
        tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
        maxZoom = 17;
      } else if (baseStyle === "agricultural") {
        // High-contrast satellite tile
        tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      }

      tileLayerRef.current = L.tileLayer(tileUrl, {
        maxZoom: maxZoom,
        subdomains: ["a", "b", "c", "d"]
      }).addTo(map);
    };

    updateTiles();
  }, [baseStyle]);

  // Fly to new center when changed
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, zoom, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [center, zoom]);

  // Render Drawn Vertices & Live Polygon Preview
  useEffect(() => {
    if (!mapInstanceRef.current || !drawingGroupRef.current) return;

    const renderDrawing = async () => {
      const L = (await import("leaflet")).default;
      const group = drawingGroupRef.current;
      group.clearLayers();

      if (drawnVertices.length > 0) {
        // Draw polyline connecting vertices
        L.polyline(drawnVertices, {
          color: "#F59E0B",
          weight: 3,
          dashArray: "6, 6",
          opacity: 0.9
        }).addTo(group);

        // Draw vertex circle markers
        drawnVertices.forEach((vertex, idx) => {
          const isFirst = idx === 0;
          const marker = L.circleMarker(vertex, {
            radius: isFirst ? 7 : 5,
            fillColor: isFirst ? "#10B981" : "#F59E0B",
            color: "#FFFFFF",
            weight: 2,
            fillOpacity: 1
          }).addTo(group);

          if (isFirst && drawnVertices.length >= 3) {
            marker.bindTooltip("Click to close boundary", { permanent: true, direction: "top" });
            marker.on("click", (e: any) => {
              L.DomEvent.stopPropagation(e);
              onCompletePolygon();
            });
          }
        });
      }
    };

    renderDrawing();
  }, [drawnVertices, onCompletePolygon]);

  // Render Farm Intelligence Overlays (Farm Boundary, Heatmaps, Zones, Barren Land)
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;

    const renderOverlays = async () => {
      const L = (await import("leaflet")).default;
      const group = layersGroupRef.current;
      group.clearLayers();

      // 1. Render Active Farm Boundary or Custom Polygon
      const boundaryToRender = customPolygon || (farmData?.boundary ? farmData.boundary.map((p) => [p[1], p[0]] as [number, number]) : null);

      if (boundaryToRender && boundaryToRender.length >= 3) {
        // Primary Farm Boundary Polygon
        let fillColor = "#10B981";
        let fillOpacity = 0.25;

        if (activeLayer === "ndvi") {
          fillColor = "#84CC16";
          fillOpacity = 0.45;
        } else if (activeLayer === "moisture") {
          fillColor = "#0284C7";
          fillOpacity = 0.40;
        } else if (activeLayer === "irrigation_risk") {
          fillColor = "#F59E0B";
          fillOpacity = 0.35;
        }

        const farmPoly = L.polygon(boundaryToRender, {
          color: "#10B981",
          weight: 3.5,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          className: "transition-all duration-300"
        }).addTo(group);

        farmPoly.bindTooltip(
          `<strong>${farmData?.name || "Active Farm Field"}</strong><br/>Crop: ${farmData?.crop || "Wheat"} • Area: ${farmData?.area_hectares || 12.4} ha`,
          { direction: "top", opacity: 0.95 }
        );
      }

      // 2. Render Farm Zones if Enabled
      if (showZones && farmData?.zones) {
        farmData.zones.forEach((zone) => {
          const isSelected = selectedZone?.zone_id === zone.zone_id;
          const isStressed = zone.status === "stressed" || zone.risk_level === "high";
          const isModerate = zone.status === "moderate";

          let zoneColor = "#10B981";
          if (isStressed) zoneColor = "#EF4444";
          else if (isModerate) zoneColor = "#F59E0B";

          // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
          const zoneCoords = zone.polygon.map((pt) => [pt[1], pt[0]] as [number, number]);

          const poly = L.polygon(zoneCoords, {
            color: isSelected ? "#FFFFFF" : zoneColor,
            weight: isSelected ? 3 : 1.5,
            fillColor: zoneColor,
            fillOpacity: isSelected ? 0.55 : 0.30,
            dashArray: isSelected ? undefined : "4, 4"
          }).addTo(group);

          poly.bindTooltip(
            `<strong>${zone.name}</strong><br/>NDVI: ${zone.ndvi} • Moisture: ${zone.moisture_score}%<br/>Status: ${zone.status.toUpperCase()}`,
            { direction: "center", permanent: false }
          );

          poly.on("click", (e: any) => {
            L.DomEvent.stopPropagation(e);
            onSelectZone(zone);
          });
        });
      }

      // 3. Render Barren Land Parcels
      if (activeLayer === "barren_land" || activeLayer === "crop_health") {
        if (farmData?.barren_land) {
          farmData.barren_land.forEach((parcel) => {
            const isSelected = selectedBarrenParcel?.parcel_id === parcel.parcel_id;
            const parcelCoords = parcel.polygon.map((pt) => [pt[1], pt[0]] as [number, number]);

            const pPoly = L.polygon(parcelCoords, {
              color: isSelected ? "#A855F7" : "#C084FC",
              weight: isSelected ? 3 : 2,
              fillColor: "#9333EA",
              fillOpacity: isSelected ? 0.45 : 0.25,
              dashArray: "5, 5"
            }).addTo(group);

            pPoly.bindTooltip(
              `<strong>${parcel.name}</strong><br/>Area: ${parcel.area_hectares} ha (${parcel.area_acres} ac)<br/>Potential: ${parcel.estimated_potential}`,
              { direction: "top" }
            );

            pPoly.on("click", (e: any) => {
              L.DomEvent.stopPropagation(e);
              onSelectBarrenParcel(parcel);
            });
          });
        }
      }
    };

    renderOverlays();
  }, [farmData, customPolygon, activeLayer, showZones, selectedZone, selectedBarrenParcel, onSelectZone, onSelectBarrenParcel]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-3xl border border-neutral-800/80 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full z-0" style={{ background: "#0a0a0a" }} />

      {/* Floating Mode Banner during boundary drawing */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-amber-500/90 backdrop-blur-xl text-neutral-950 font-bold px-4 py-2 rounded-2xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
            <span>Click map points to draw farm boundary. Click first point to finish!</span>
          </div>
        </div>
      )}
    </div>
  );
}
