import type { ReactNode } from "react";
import { BedDouble, ConciergeBell, FileText } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

/** Two-column layout for sign-in, sign-up and first-time setup. Brand panel hides on small screens. */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo variant="login" className="h-14 w-auto self-start" />
        <div className="max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight text-sidebar-primary">Run your front desk with less effort.</h2>
          <ul className="mt-8 space-y-4 text-[15px]">
            <li className="flex items-center gap-3"><ConciergeBell className="size-5 shrink-0" /> Check guests in and out quickly</li>
            <li className="flex items-center gap-3"><BedDouble className="size-5 shrink-0" /> See which rooms are clean and ready</li>
            <li className="flex items-center gap-3"><FileText className="size-5 shrink-0" /> Keep every bill correct, in naira (₦)</li>
          </ul>
        </div>
        <p className="text-sm text-sidebar-foreground/60">Built for hotels in Nigeria and across Africa.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className={wide ? "w-full max-w-lg" : "w-full max-w-md"}>
          <BrandLogo variant="login" className="mb-8 h-11 w-auto lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
