import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrganizationSelf } from "@/shared/api/organization";

const DEFAULT_TITLE = document.title;
const DEFAULT_FAVICON_HREF = "/favicon.svg";
const DEFAULT_FAVICON_TYPE = "image/svg+xml";
const BRAND_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

function applyPrimaryColor(color: string | null) {
  const root = document.documentElement;
  if (!color || !/^#[\da-f]{6}$/i.test(color)) {
    BRAND_SHADES.forEach(shade => root.style.removeProperty("--color-brand-" + shade));
    return;
  }
  const rgb = color.match(/[\da-f]{2}/gi)!.map(value => parseInt(value, 16));
  const hex = (channel: number) => channel.toString(16).padStart(2, "0");
  const tint = (amount: number) => "#" + rgb.map(channel => hex(Math.round(channel + (255 - channel) * amount))).join("");
  const shade = (amount: number) => "#" + rgb.map(channel => hex(Math.round(channel * (1 - amount)))).join("");
  [tint(.95), tint(.85), tint(.70), tint(.50), tint(.25), color, shade(.12), shade(.25), shade(.38), shade(.50)]
    .forEach((value, index) => root.style.setProperty("--color-brand-" + BRAND_SHADES[index], value));
}

// SADM-US-014's own AC, narrowed to the two things that don't need a new
// endpoint or a colour system: the browser tab already carries the
// currently-logged-in tenant's name and logo the moment they're
// authenticated, since getOrganizationSelf() is already fetched by
// Sidebar/MobileTopBar (same query key — React Query dedupes the request,
// this doesn't add a second network call). Full palette theming and the
// pre-login screen are out of scope here — AuthLayout's own why-note
// explains why pre-login branding needs a public endpoint that doesn't
// exist yet (OrganizationBrandingService requires a tenant JWT).
export function useOrganizationBranding() {
  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });
  const org = orgQuery.data;

  useEffect(() => {
    if (!org) return;

    document.title = org.displayName;
    applyPrimaryColor(org.primaryColor);

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link && org.logoUrl) {
      link.href = org.logoUrl;
      // The uploaded logo's real mime type isn't known from the URL alone
      // (validated server-side at upload as jpeg/png/webp, never svg) — an
      // explicit svg+xml type on a raster image makes some browsers refuse
      // it outright, so this is cleared rather than guessed.
      link.removeAttribute("type");
    }

    // AC2: "no branding configured -> platform default" — restored on
    // unmount too, not just on the no-logo branch above, so navigating out
    // of the tenant app (platform console, sign-out to the login screen)
    // never leaves a previous tenant's tab identity behind for whatever
    // renders next.
    return () => {
      document.title = DEFAULT_TITLE;
      applyPrimaryColor(null);
      if (link) {
        link.href = DEFAULT_FAVICON_HREF;
        link.type = DEFAULT_FAVICON_TYPE;
      }
    };
  }, [org]);
}
