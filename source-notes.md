# Data and realism notes

## Current FAA airport diagram

Development target: **FAA D-TPP 2609 — Frederick W Smith Intl/Memphis (MEM)**, effective **03 SEP 2026 through 01 OCT 2026**.

Official current-cycle reference used during development:

- https://aeronav.faa.gov/d-tpp/2609/00253ad.pdf

The current diagram publishes, among other items used by the game:

- D-ATIS 127.75
- Clearance Delivery 125.2
- Ground 121.0 for Runway 09/27; 121.65 for 18R/36L; 121.9 for 18L/36R and 18C/36C
- Tower 118.3 for Runway 09/27; 128.425 for 18R/36L; 119.7 for 18L/36R and 18C/36C
- A caution that runway holding instructions require readback

## FAA procedural references

- FAA Order JO 7110.65BB — Air Traffic Control (active order; use the FAA's current consolidated version and notices):
  https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.current/documentnumber/7110.65
- FAA AIM, Chapter 4, Air Traffic Control, including airport surface operations and readback guidance:
  https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4_section_3.html

## Supplied MEMSim data

The user-supplied MEMSim map/aircraft graph remains the primary spatial movement dataset. It provides the aircraft routing graph, centerline geometry, gates, runway polygons, hub geometry and building data. The ATC game adds an operational-reference layer on top of that data rather than replacing it.

## Limitations

Taxiway label points in `data/airport-reference.js` are **display references** georeferenced from the supplied chart image; they are not surveyed coordinates and are not used as navigation truth. The movement engine uses the supplied graph. Exact edge-to-taxiway tagging is a planned realism upgrade.
