import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outDir = path.join(root, 'assets', 'generated');
await fs.mkdir(outDir, { recursive: true });

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6EC7EA"/>
      <stop offset="0.52" stop-color="#F7C870"/>
      <stop offset="1" stop-color="#0A3143"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFF5B5"/>
      <stop offset="1" stop-color="#FFB53D"/>
    </linearGradient>
    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE69B"/>
      <stop offset="1" stop-color="#68B5D2"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>
  <circle cx="748" cy="300" r="122" fill="url(#sun)" opacity="0.98"/>
  <path d="M0 495 L150 350 L247 439 L368 300 L490 455 L611 338 L742 474 L862 351 L1024 486 L1024 660 L0 660 Z" fill="#3F7892"/>
  <path d="M0 570 L184 426 L330 563 L487 412 L632 564 L792 436 L1024 574 L1024 735 L0 735 Z" fill="#255B70"/>
  <path d="M0 650 C170 600 278 643 386 624 C526 598 642 568 1024 617 L1024 1024 L0 1024 Z" fill="#0B3A42"/>
  <path d="M667 497 C716 547 718 604 673 653 C629 702 588 752 571 834 C616 790 670 749 735 722 C791 699 842 667 874 621 C825 617 777 603 748 575 C721 549 698 523 667 497 Z" fill="url(#river)" opacity="0.95"/>
  <g opacity="0.95" fill="#102A33">
    <path d="M52 723 l44 -92 44 92 h-26 v94 h-36 v-94z"/>
    <path d="M126 748 l36 -76 36 76 h-21 v79 h-30 v-79z"/>
    <path d="M880 730 l40 -86 40 86 h-23 v91 h-34 v-91z"/>
    <path d="M931 753 l31 -64 31 64 h-19 v70 h-25 v-70z"/>
  </g>
  <ellipse cx="504" cy="907" rx="310" ry="74" fill="#071E2A" opacity="0.6"/>
  <g>
    <circle cx="430" cy="606" r="58" fill="#182733"/>
    <path d="M356 702 C363 636 402 608 450 614 C504 620 541 661 546 735 L564 905 L320 905 L338 760 C341 738 346 719 356 702 Z" fill="#0D2A3C"/>
    <path d="M382 665 C407 684 455 688 488 659 L514 703 C472 735 397 732 354 697 Z" fill="#153E57"/>
    <circle cx="600" cy="657" r="43" fill="#3A261E"/>
    <path d="M548 727 C555 679 584 655 619 661 C660 668 687 701 690 751 L699 905 L524 905 L533 770 C535 754 540 738 548 727 Z" fill="#E59B2E"/>
    <path d="M526 714 C564 703 590 699 626 706 C647 710 664 721 680 739 L650 774 C630 752 609 741 582 739 C560 738 543 742 526 750 Z" fill="#F1B74A"/>
    <path d="M469 703 C510 726 548 739 587 741 C614 742 635 731 652 713" fill="none" stroke="#0D2A3C" stroke-width="38" stroke-linecap="round"/>
  </g>
  <path d="M0 926 C174 879 357 913 517 892 C692 869 811 844 1024 884 L1024 1024 L0 1024 Z" fill="#061E29"/>
</svg>`;

const heroSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="heroSky" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#74C8E8"/>
      <stop offset="0.45" stop-color="#F7D19A"/>
      <stop offset="1" stop-color="#173F4D"/>
    </linearGradient>
    <linearGradient id="heroSun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFF9C9"/>
      <stop offset="1" stop-color="#F4A53D"/>
    </linearGradient>
    <linearGradient id="heroRiver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF0B1"/>
      <stop offset="1" stop-color="#75C7D8"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#heroSky)"/>
  <circle cx="1175" cy="255" r="128" fill="url(#heroSun)"/>
  <circle cx="1175" cy="255" r="180" fill="#FFD977" opacity="0.12"/>
  <path d="M0 500 L170 340 L315 475 L490 292 L660 490 L810 356 L960 500 L1130 332 L1290 488 L1450 355 L1600 480 L1600 650 L0 650 Z" fill="#4C839A"/>
  <path d="M0 590 L210 432 L390 574 L585 403 L770 570 L960 438 L1170 574 L1370 430 L1600 590 L1600 740 L0 740 Z" fill="#2A6071"/>
  <path d="M0 650 C230 610 410 661 603 626 C785 594 960 570 1600 629 L1600 900 L0 900 Z" fill="#0D3D46"/>
  <path d="M1121 452 C1175 506 1192 554 1168 601 C1145 648 1081 686 1064 733 C1053 765 1066 809 1096 852 C1031 822 987 785 974 741 C960 692 987 653 1039 610 C1087 571 1110 520 1121 452 Z" fill="url(#heroRiver)" opacity="0.9"/>
  <g fill="#0A2A33" opacity="0.96">
    <path d="M61 686 l52 -113 52 113 h-30 v114 h-44 v-114z"/>
    <path d="M144 719 l39 -86 39 86 h-24 v91 h-31 v-91z"/>
    <path d="M1450 690 l49 -108 49 108 h-30 v116 h-40 v-116z"/>
    <path d="M1372 724 l36 -77 36 77 h-21 v83 h-30 v-83z"/>
  </g>
  <ellipse cx="705" cy="820" rx="380" ry="75" fill="#071F2A" opacity="0.54"/>
  <g transform="translate(265,120)">
    <circle cx="355" cy="392" r="61" fill="#1A2934"/>
    <path d="M270 493 C278 422 321 390 375 397 C434 404 475 449 480 530 L500 730 L229 730 L250 554 C253 531 260 509 270 493 Z" fill="#0A2B3D"/>
    <path d="M299 453 C327 474 380 479 416 445 L444 494 C398 528 317 526 268 489 Z" fill="#184C61"/>
    <circle cx="551" cy="449" r="45" fill="#3A281F"/>
    <path d="M494 523 C502 471 533 447 572 454 C617 462 647 498 650 553 L661 730 L468 730 L479 570 C481 551 487 535 494 523 Z" fill="#E7A336"/>
    <path d="M472 510 C514 498 543 495 583 502 C606 506 626 518 644 538 L612 576 C589 552 566 540 537 538 C512 537 491 542 472 551 Z" fill="#F3BA4C"/>
    <path d="M398 493 C442 518 486 531 529 533 C560 534 582 521 602 501" fill="none" stroke="#0A2B3D" stroke-width="41" stroke-linecap="round"/>
  </g>
  <rect x="0" y="0" width="1600" height="900" fill="#071F2A" opacity="0.08"/>
</svg>`;

const monochromeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="none"/>
  <circle cx="430" cy="365" r="86" fill="#fff"/>
  <path d="M286 547 C296 438 363 389 448 400 C540 411 604 481 612 609 L638 884 L220 884 L251 646 C257 608 267 574 286 547 Z" fill="#fff"/>
  <circle cx="655" cy="455" r="63" fill="#fff"/>
  <path d="M566 583 C576 511 620 476 680 486 C745 497 789 549 794 626 L808 884 L538 884 L553 650 C555 624 560 601 566 583 Z" fill="#fff"/>
  <path d="M498 573 C556 607 615 624 672 626 C713 628 744 609 770 582" fill="none" stroke="#fff" stroke-width="58" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(iconSvg)).png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(path.join(outDir, 'app-icon.png'));
await sharp(Buffer.from(heroSvg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(outDir, 'family-hero.png'));
await sharp(Buffer.from(monochromeSvg)).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'app-icon-monochrome.png'));

console.log('Generated Papa & Ya brand assets in assets/generated');
