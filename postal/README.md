# POSTAL live operations game

POSTAL is a mobile-portrait, pausable real-time parcel-network game set in Sweden. Its interaction loop is inspired by the immediacy of time-management games: read the live scene, select a waiting parcel batch, tap its marked physical destination, and keep limited teams and vehicles moving before promises expire.

## Shift campaign

1. **First rounds — calm practice.** One DLH batch teaches the core select-and-route interaction from Sundsvall's town terminal to Härnösand. The clock is stopped and the consequential action happens in the miniature world, not in a duplicate instruction button.
2. **After-work rush — town.** NordPost, DLH, Brang and USP vans feed two sorting lanes in real time. Two teams must absorb the arriving work while a scanner disruption can stall the floor.
3. **Region pulse — town + region.** Sundsvall sorting continues while Timrå, Härnösand, Matfors and the national gate compete for two regional trucks. Snow can close the direct route until the player opens the inland detour.
4. **Sweden by night — town + region + Sweden.** Stockholm and Gothenburg become live national hubs while the lower levels continue operating. A blocked national dock creates another simultaneous concern.
5. **Friday surge — peak network.** More batches, faster arrivals, all four carriers, all three levels and three timed disruptions. Replay variants alter carrier and destination order.

Shifts unlock in order so each new level is learned through play. Completion, best results and replay variants are stored locally. Existing campaign players retain their completed first shift and begin with the redesigned live operation.

## Live interaction model

- Parcel batches are semantic HTML buttons over the 3D operation scene. Each combines carrier, destination, promise countdown, service shape and processing state.
- Selecting a waiting batch exposes its route mark. Tapping the corresponding lane, depot or national hub immediately commits a team or vehicle.
- Busy capacity creates an automatic first-in queue. Wrong destinations cost score and promise margin but leave the batch selected for correction.
- Batches can progress through Town, Region and Sweden. Advanced schedules also inject partner work directly at higher levels so several levels demand attention at once.
- Level badges report unattended batches and disruptions without interrupting play.
- On-time deliveries build a score combo. Late or missed work breaks it; shifts close automatically after all arriving work is resolved.

## Presentation and feedback

- Fixed isometric 3D terminal, regional diorama and national Sweden board use small CC0 Kenney assets vendored under `assets/`; see [`assets/ATTRIBUTION.md`](./assets/ATTRIBUTION.md).
- The national board contains interactive Sundsvall, Stockholm and Gothenburg hubs, animated routes and moving linehaul vehicles.
- The required three.js modules are vendored locally, so the game does not depend on a third-party CDN at runtime.
- Interface feedback uses a quiet family of very short, low-volume triangle tones synthesized through a low-pass filter.
- Consequential detail remains available on demand through a structured live-network dialog; opening it pauses play.

## Accessibility

- Every consequential canvas state is repeated in semantic HTML.
- Projected world hotspots are real buttons with accessible names. Parcel markers pair carrier colour with codes, express/standard colour with shapes, and urgency with numeric countdowns.
- The first shift introduces the input grammar without running a deadline; later shifts remove the coaching copy.
- Town, Region and Sweden badges expose waiting counts and disruptions to assistive technology.
- Reduced-motion preferences remove camera sweeps, pulsing and non-essential animation.
- A no-WebGL fallback preserves the parcel controls, destinations, level navigation and structured details.

## Local run and checks

Serve the repository root over HTTP and open `/postal/`.

```sh
python -m http.server 4173
node --test postal/tests/*.test.mjs
node --check postal/main.mjs
node --check postal/world.mjs
```
