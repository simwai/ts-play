# Code Review Request: Mobile Optimization & Bug Fixes

## Overview
This PR addresses several mobile-specific UX issues and improves application stability.

## Key Changes
1.  **Mobile Context Menu**: Disabled Monaco's internal hover and context menu on mobile to allow the native browser menu (for copy/paste/share) to appear.
2.  **Horizontal Scrolling**: Fixed a bug where horizontal scrolling in the editor was blocked by the tab-switching swipe gesture. Swipe detection is now restricted to non-editor areas.
3.  **UI Thread Protection**: Added yielding to the WebContainer output stream processing to prevent browser crashes (black screens) caused by high-volume terminal output.
4.  **Console Enhancements**: Added message filtering (All, Log, Info, Warn, Error) and a toggle to show/hide Node.js warnings.
5.  **Settings Modal Redesign**: Improved mobile ergonomics with a scrollable content area and fixed header/footer.
6.  **Type Info Bar Redesign**: Optimized the layout for small screens, ensuring large type signatures don't break the UI.

## Verification Results
- All unit and E2E tests passed.
- Frontend verified with Playwright screenshots on mobile-sized viewport.
- Verified that Settings Modal is now correctly scrollable with a fixed footer.
- Verified that Console filter buttons are present and styled correctly.
