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
