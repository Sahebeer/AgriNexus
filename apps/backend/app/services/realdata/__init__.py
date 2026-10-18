"""Real (non-simulated) data connectors: Sentinel-2 via Element84 STAC, Open-Meteo, ISRIC SoilGrids.

Every value produced here carries provenance (source, date, and for satellite
data the scene id, cloud % and valid-pixel %). Simulated fallbacks are always
labelled ``source: "demo"``.

Parts of this package are adapted from OpenFarm (BSD-3-Clause,
Copyright (c) 2026, OpenFarm Contributors); see LICENSE-OpenFarm.txt and the
per-file headers naming the source module.
"""
