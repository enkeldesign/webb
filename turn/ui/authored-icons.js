// Authored TURN icon artwork shared by Achievements and Trophy Road.
// Keep these strings as the source-of-truth SVG markup rather than duplicating
// or reconstructing the artwork at each rendering surface.

export const AUTHORED_DRIFT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true">
  <path
    d="M 222 195 C 132 286, 63 409, 53 605"
    fill="none"
    stroke="currentColor"
    stroke-width="49"
    stroke-linecap="round"
  />

  <path
    d="M 398 266 C 326 346, 268 454, 258 598"
    fill="none"
    stroke="currentColor"
    stroke-width="49"
    stroke-linecap="round"
  />

  <path
    d="M 467 596
       C 475 504, 509 401, 571 321
       C 626 251, 700 198, 790 148"
    fill="none"
    stroke="currentColor"
    stroke-width="49"
    stroke-linecap="butt"
    stroke-dasharray="54 51"
  />

  <g transform="rotate(-15 371 169)">
    <rect
      x="183"
      y="62"
      width="384"
      height="215"
      rx="31"
      fill="currentColor"
    />

    <rect x="232" y="103" width="59" height="122" fill="transparent" />
    <rect x="464" y="103" width="44" height="122" fill="transparent" />
  </g>
</svg>`;

export const AUTHORED_SAFETY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true">

  <!-- Left broken road edge -->
  <path
    d="
      M 142 150
      C 205 220, 225 318, 198 410
      C 166 518, 130 610, 122 714
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="butt"
    stroke-dasharray="78 62"
  />

  <!-- Right broken road edge -->
  <path
    d="
      M 605 104
      C 681 194, 708 301, 688 397
      C 663 505, 632 608, 636 710
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="butt"
    stroke-dasharray="78 62"
  />

  <!-- Left tyre trail -->
  <path
    d="
      M 365 368
      C 405 443, 412 512, 365 570
      C 310 637, 286 678, 282 724
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="round"
  />

  <!-- Right tyre trail -->
  <path
    d="
      M 455 348
      C 520 421, 540 504, 505 574
      C 469 645, 454 686, 453 722
    "
    fill="none"
    stroke="currentColor"
    stroke-width="58"
    stroke-linecap="round"
  />

<!-- Car -->
<g transform="rotate(-20 400 300)">

  <!-- Main body, with windows cut out -->
  <path
    d="
      M 335 155
      H 465
      Q 500 155 500 190
      V 405
      Q 500 440 465 440
      H 335
      Q 300 440 300 405
      V 190
      Q 300 155 335 155
      Z

      M 337 210
      H 463
      V 239
      H 337
      Z

      M 337 294
      H 463
      V 323
      H 337
      Z
    "
    fill="currentColor"
    fill-rule="evenodd"
    clip-rule="evenodd"
  />

</g>

</svg>`;

// Source artwork supplied as a tall spray-can SVG. The production version keeps
// only the two visible silhouette paths, removes the XML/DTD, fixed dimensions and
// white background geometry, crops the viewBox to the artwork, and inherits TURN's
// icon colour through currentColor like the other authored SVG families.
export const AUTHORED_PAINT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="150 160 700 1335" aria-hidden="true">
  <g fill="currentColor" stroke="none">
    <path d="m182.86 1474.1c-5.27-1.56-11.38-6.83-14.01-11.98-2.39-4.67-2.39-7.78-2.39-485.11v-480.44l2.99-5.15c1.92-3.23 5.27-6.47 8.62-8.5 4.91-2.87 7.3-3.35 17.12-3.71l11.38-0.48 6.47-11.38c18.56-32.93 48.14-62.63 83.35-83.71 12.21-7.3 33.05-16.88 44.07-20.36l6.83-2.16v-67.42c0-65.02 0.12-67.66 2.39-72.21 2.63-5.27 8.14-9.82 14.25-11.86 2.87-0.96 25.99-1.32 78.44-1.32 69.69 0 74.6 0.24 79.15 2.28 8.86 4.07 13.77 12.21 13.77 22.87 0 5.27 0.36 5.99 2.39 5.99 5.63 0 12.21 5.39 16.29 13.17 1.8 3.59 2.16 7.3 2.16 27.66-0.12 22.03-0.24 23.83-2.87 29.1-3.11 6.47-8.26 10.3-14.01 10.3h-3.95v20.96c0 16.17 0.36 20.96 1.56 20.96 2.39 0 18.32 6.35 30.78 12.33 45.15 21.56 81.19 55.32 104.3 97.36l4.07 7.42 11.5 0.48c10.18 0.36 12.09 0.84 16.53 3.71 2.63 1.8 6.35 5.51 8.14 8.26l3.35 5.03 0.24 480.2 0.36 480.32-3.59 6.11c-2.75 4.91-4.91 6.95-9.82 9.34l-6.23 3.11-255.07-0.12c-140.35 0-256.74-0.6-258.54-1.08zm481.75-249.08v-199.98h-170.88c-121.55 0-172.44-0.36-175.79-1.32-6.35-1.8-14.37-9.82-16.05-16.29-0.96-3.59-1.32-50.65-1.08-167.05l0.36-162.02 2.99-5.39c1.92-3.35 5.15-6.59 8.86-8.98l5.87-3.59 172.92-0.36 172.8-0.24v-65.26-65.26h-223.33-223.33v447.86 447.86h223.33 223.33v-199.98zm0-382v-131.73h-155.68-155.68v131.73 131.73h155.68 155.68v-131.73zm-56.04-369.67c-6.11-7.3-22.99-23.59-30.78-29.94-24.67-19.88-61.67-36.64-96.52-43.71-11.74-2.28-17.36-2.75-40-2.75-30.54 0-42.51 1.8-69.46 10.78-37.72 12.33-67.78 31.97-93.64 61.07-4.19 4.55-7.54 8.74-7.54 9.34 0 0.48 77.12 0.84 171.36 0.84h171.36l-4.79-5.63zm-167.29-127.89c9.22 0 22.51 0.36 29.7 0.84l12.81 0.96v-44.31-44.31h-42.51-42.51v44.31 44.31l12.93-0.96c7.07-0.48 20.36-0.84 29.58-0.84z"/>
    <path d="m738.86 360.93c-29.94-10.3-80.83-27.54-112.92-38.32s-59.52-20.24-60.71-20.84c-3.11-1.68-2.99-5.63 0.24-15.81l2.63-8.14-2.63-8.98c-1.44-4.91-2.63-10.66-2.63-12.81 0-3.83 0.24-4.07 7.54-6.11 8.62-2.51 75.8-23.47 102.03-31.97 9.94-3.11 35.45-11.26 56.88-17.96 21.44-6.71 44.67-14.01 51.73-16.29 7.3-2.39 14.49-4.07 16.76-3.83l3.95 0.36 5.63 17.36c3.11 9.58 5.75 19.4 5.75 21.79v4.43l-20.6 6.59c-11.38 3.59-35.69 11.26-54.13 17.12l-33.41 10.54 62.99 0.36c62.51 0.24 62.99 0.24 63.71 2.75 0.48 1.32 0.48 11.62 0 22.75l-0.96 20.24-53.65 0.24-53.65 0.36 45.39 15.45 45.51 15.45-0.12 5.51c0 3.35-2.16 11.74-5.75 21.67l-5.75 16.17-4.67 0.24c-3.35 0.24-20-4.91-59.16-18.32z"/>
  </g>
</svg>`;
