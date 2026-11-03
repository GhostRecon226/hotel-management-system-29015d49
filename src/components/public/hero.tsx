import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HotelScene } from "@/components/public/home/hotel-scene";
import { Eyebrow } from "@/components/public/public-layout";

/*
 * Home hero: the light treatment from the approved storyboard. Same type, buttons and spacing as the rest of the site.
 * Zikora is for hotel owners and staff, so nothing here speaks to guests.
 */
export function Hero() {
  return (
    <section className="home-hero relative overflow-hidden border-b border-border/60">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:py-24">
        <div className="hs-fade">
          <Eyebrow>Hotel management for owners and their teams</Eyebrow>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-primary-strong sm:text-5xl lg:text-6xl">
            Run your whole hotel from one screen.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">Bookings, rooms, money and reports. Everything connected.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Start 60 days free <ArrowRight aria-hidden /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#preview">See Zikora in action</a></Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Every feature. No card needed.</p>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-none"><HotelScene /></div>
      </div>
    </section>
  );
}
