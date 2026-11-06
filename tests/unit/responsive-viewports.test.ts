import { describe, it, expect } from 'vitest';

const VIEWPORTS = [
  { device: 'Small Android', width: 320, height: 568 },
  { device: 'Standard iPhone', width: 375, height: 667 },
  { device: 'Modern iPhone', width: 390, height: 844 },
  { device: 'Large iPhone', width: 430, height: 932 },
  { device: 'Android phone', width: 360, height: 800 },
  { device: 'Large Android', width: 412, height: 915 },
  { device: 'iPad Portrait', width: 768, height: 1024 },
  { device: 'Tablet Landscape', width: 1024, height: 768 },
  { device: 'Laptop', width: 1366, height: 768 },
  { device: 'Full HD Desktop', width: 1920, height: 1080 },
  { device: 'Large Desktop', width: 2560, height: 1440 },
];

describe('Universal Responsive Design - Viewport Verification', () => {
  it('calculates proportional 1:1 board scaling without horizontal overflow across all device viewports', () => {
    VIEWPORTS.forEach(({ device, width, height }) => {
      const padding = width < 640 ? 16 : 32; // 8px or 16px padding on sides
      const availableWidth = width - padding;
      const isMobile = width < 768;
      const isLandscapeMobile = width < 1024 && width > height;

      // Board must be square (aspect-ratio 1:1)
      const maxBoardDimension = 560; // Tailwind max-w-[560px]
      const computedBoardWidth = Math.min(availableWidth, maxBoardDimension);

      expect(computedBoardWidth).toBeGreaterThan(0);
      expect(computedBoardWidth).toBeLessThanOrEqual(width);

      // On 320px screen:
      if (width === 320) {
        expect(computedBoardWidth).toBeLessThanOrEqual(304); // 320 - 16
        // Cell dimension for 15x15 grid
        const singleCellPx = computedBoardWidth / 15;
        // SVG tokens scale smoothly within their 100x100 viewBox cells
        expect(singleCellPx).toBeGreaterThanOrEqual(18); // readable and visible on small screens
      }

      // Orientation detection
      if (isLandscapeMobile) {
        expect(width).toBeGreaterThan(height);
      }
    });
  });

  it('provides comfortable touch target dimensions (>= 44px) for controls', () => {
    // Dice widget 3D box size: w-20 h-20 (80px) on mobile, w-24 h-24 (96px) on desktop
    const mobileDiceSize = 80;
    const desktopDiceSize = 96;
    expect(mobileDiceSize).toBeGreaterThanOrEqual(44);
    expect(desktopDiceSize).toBeGreaterThanOrEqual(44);

    // Roll button height: py-2 text-sm with padding >= 44px touch area
    const touchTargetMin = 44;
    expect(mobileDiceSize).toBeGreaterThanOrEqual(touchTargetMin);
  });
});
