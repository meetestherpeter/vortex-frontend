import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

type UseDismissableOverlayOptions = {
  isOpen: boolean;
  onClose: () => void;
  /** The button that opens the overlay; focus returns here on close. */
  triggerRef: React.RefObject<HTMLElement>;
};

/**
 * Shared overlay dismissal behavior: closes on Escape (returning focus to the
 * trigger), closes on outside click/tap, and traps Tab focus within the
 * overlay while it's open. Used by the chain picker, mobile nav, and
 * settings dropdown so the three don't reimplement the same logic.
 *
 * This is the single focus-management implementation that the shared
 * `Dialog`/`Popover` primitives (src/components/ui) are built on top of, so
 * nested overlays share one stack and dismiss in LIFO order.
 */
export function useDismissableOverlay<T extends HTMLElement>({
  isOpen,
  onClose,
  triggerRef,
}: UseDismissableOverlayOptions) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

    // Initial focus: first focusable child, falling back to the container
    // itself so focus never escapes to the background.
    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container?.setAttribute("tabindex", "-1");
      container?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // stopPropagation so a nested overlay dismisses only the topmost
        // layer instead of every ancestor listening on document.
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        container?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Ignore clicks on the trigger itself: its own onClick already toggles
    // the overlay, so also closing it here would immediately reopen it.
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (container?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      // Return focus to the trigger (or the element focused before opening)
      // so nested overlays restore focus in LIFO order.
      const returnTarget = triggerRef.current ?? previouslyFocused;
      if (returnTarget && document.contains(returnTarget)) {
        returnTarget.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  return containerRef;
}
