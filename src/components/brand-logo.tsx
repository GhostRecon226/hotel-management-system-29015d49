import { cn } from "@/lib/utils";

/**
 * The Zikora logo. Files live in public/brand (see docs/brand.md).
 * "full" is the mark with the name, "icon" is the Z alone.
 * The dark-screen version shows when the app is in dark mode, or always with `onDark`.
 */
export function BrandLogo({ variant = "full", onDark, className }: { variant?: "full" | "icon" | "login"; onDark?: boolean; className?: string }) {
  const light = variant === "icon" ? "/brand/zikora-icon.png" : "/brand/zikora-logo-login.png";
  const dark = variant === "icon" ? "/brand/zikora-icon-dark-screen.svg" : "/brand/zikora-logo-dark-screen.svg";
  if (onDark) return <img src={dark} alt="Zikora" className={className} />;
  return (
    <>
      <img src={light} alt="Zikora" className={cn("dark:hidden", className)} />
      <img src={dark} alt="" aria-hidden="true" className={cn("hidden dark:block", className)} />
    </>
  );
}
