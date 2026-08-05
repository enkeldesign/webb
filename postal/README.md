# POSTAL portrait interaction prototype

This directory contains a non-production, mobile-portrait prototype for the POSTAL game concept.

## Product decisions represented here

- **Primary play context:** mobile portrait, with one-handed touch use as the default.
- **Secondary context:** wider tablet and desktop layouts may enhance the presentation later, but must not be required for complete play.
- **Session shape:** a 10–20 minute live shift, surrounded by short preparation and postmortem phases.
- **Time model:** pausable real time with speed controls and optional automatic pause for critical incidents.
- **Primary mobile surface:** an operations feed that ranks consequences and deadlines. The map supports orientation and investigation; it is not the only way to understand or control the network.
- **Core loop:** read the flow → protect the shift → trace an anomaly → correlate similar packages → correct the system → verify recovery.
- **Depth strategy:** keep the number of systems bounded, but make timing, staffing, capacity, routing, package promises and disruption interact.
- **Package identity:** every package can have a coherent history, while ordinary package flows may be aggregated internally.
- **Accessibility:** map, terminal, incident and package states must also be available as structured semantic views.

## Prototype question

Can a player understand, diagnose and correct a systemic parcel failure comfortably on a portrait phone without the game feeling like a dashboard or a reduced desktop interface?

The prototype focuses on:

1. Consequence-ranked alerts.
2. Persistent context across Operations, Network, Terminal and Cases views.
3. A representative package trace.
4. Finding similar package failures.
5. Distinguishing symptom relief from a root-cause correction.
6. Verifying that a correction changed later package outcomes.

## Deliberate exclusions

- No selected game engine.
- No production simulation architecture.
- No Kenney assets.
- No final visual presentation decision between 2D and orthographic 3D.
- No national campaign, economy or progression system.
- No attempt to reproduce real operator networks.

## Suggested first playtest

Ask the player to:

1. Identify the most important current risk.
2. Protect the immediate departure.
3. Explain why moving staff helps but does not solve the recurring error.
4. Inspect one affected package.
5. Find the common pattern.
6. correct the routing rule.
7. Verify that newly processed packages no longer show the same signature.

Observe:

- where the player first looks;
- whether bottom navigation feels natural;
- whether the map is useful or merely decorative;
- whether the package trace explains the failure;
- whether the distinction between temporary intervention and systemic fix is clear;
- whether the interface feels playful enough;
- whether the default pace feels exciting rather than stressful;
- whether any important information depends on colour or motion.

## Next decisions after testing

- Whether Operations or Network should be the default home view.
- Whether four primary destinations are too many for portrait navigation.
- Whether terminal operation should use top-down 2D or fixed orthographic 3D.
- How much information should appear inline versus in bottom sheets.
- Which actions deserve automatic pause.
- Whether the package-investigation sequence is enjoyable enough to remain a central repeated mechanic.
