import { Blocks, Building2, Fingerprint, Mail, MapPin, Search, Settings2, ChevronRight, type LucideIcon } from "lucide-react";
import { useState, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { FacilitiesSettingsSection } from "./FacilitiesSettingsSection";
import { EmailSettingsSection } from "./EmailSettingsSection";
import { ContactInfoSection } from "./ContactInfoSection";
import { ModulesSettingsSection } from "./ModulesSettingsSection";
import { SsoSettingsSection } from "./SsoSettingsSection";

type OrganizationSettingsSection = {
  id: string;
  title: string;
  group: string;
  description: string;
  keywords: string;
  icon: LucideIcon;
  component: ComponentType;
};

// Register future sections here. Each section owns its form and persistence.
const sections: OrganizationSettingsSection[] = [{
  id: "email", title: "Email", group: "Communication",
  description: "Manage the outgoing email used for your organization's notifications.",
  keywords: "smtp server sender password notifications mail", icon: Mail, component: EmailSettingsSection,
}, { id: "facilities", title: "Facilities", group: "Organization", description: "Add and maintain your organization's clinics, hospitals, stores and pharmacies.", keywords: "clinic hospital pharmacy store location address create edit", icon: Building2, component: FacilitiesSettingsSection }, {
  id: "contact-info", title: "Contact info", group: "Organization",
  description: "Manage your organization's contact details, location and online presence.",
  keywords: "address phone hours social website facebook instagram location contact", icon: MapPin,
  component: ContactInfoSection,
}, {
  id: "modules", title: "Modules", group: "Organization",
  description: "Turn features on or off for your organization.",
  keywords: "modules features entitlements enable disable toggle", icon: Blocks,
  component: ModulesSettingsSection,
}, {
  id: "sso", title: "Single sign-on", group: "Communication",
  description: "Let staff sign in with their organization's Microsoft account.",
  keywords: "sso single sign on microsoft azure ad entra oauth login staff", icon: Fingerprint,
  component: SsoSettingsSection,
}];

export function OrganizationSettingsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const selected = sections.find(section => section.id === params.get("section")) ?? sections[0];
  const [visited, setVisited] = useState<string[]>([selected.id]);
  const visible = sections.filter(section =>
    `${section.title} ${section.group} ${section.description} ${section.keywords}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const groups = [...new Set(visible.map(section => section.group))];

  function selectSection(id: string) {
    setVisited(current => [...new Set([...current, selected.id, id])]);
    setParams(current => { const next = new URLSearchParams(current); next.set("section", id); return next; });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-surface-raised text-brand-600"><Settings2 className="size-6" aria-hidden /></span>
        <div><h1 className="text-[24px] font-semibold tracking-tight text-text-primary">Settings</h1>
          <p className="mt-1 text-[14px] text-text-secondary">Manage your organization's preferences, all in one place.</p></div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border-subtle bg-surface-raised p-3 lg:sticky lg:top-6">
          <label className="relative mb-5 block">
            <span className="sr-only">Search settings</span>
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-text-secondary" aria-hidden />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search settings" className="h-10 w-full rounded-lg border border-border-subtle bg-surface py-2 pl-9 pr-3 text-[13px] text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
          </label>
          <nav aria-label="Settings sections" className="max-h-[50vh] space-y-5 overflow-y-auto">
            {groups.map(group => <div key={group}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{group}</p>
              {visible.filter(section => section.group === group).map(({ id, title, icon: Icon }) => (
                <button key={id} type="button" aria-current={selected.id === id ? "page" : undefined} onClick={() => selectSection(id)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${selected.id === id ? "bg-brand-500 text-white" : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary"}`}>
                  <Icon className="size-4 shrink-0" aria-hidden /><span className="flex-1">{title}</span>{selected.id === id && <ChevronRight className="size-4" aria-hidden />}
                </button>
              ))}
            </div>)}
            {visible.length === 0 && <div role="status" className="px-3 pb-3 text-[13px] text-text-secondary">No settings match your search.<button type="button" onClick={() => setSearch("")} className="mt-2 block font-medium text-brand-600 underline">Clear search</button></div>}
          </nav>
        </aside>
        <div className="min-w-0">
          {/* Keep visited forms mounted so switching sections preserves their drafts. */}
          {sections.filter(section => visited.includes(section.id) || section.id === selected.id).map(({ id, title, description, component: Component }) => (
            <section key={id} hidden={id !== selected.id} aria-labelledby={`settings-${id}`}>
              <div className="mb-5"><p className="mb-1 text-[12px] font-medium text-text-secondary">Organization settings</p><h2 id={`settings-${id}`} className="text-[21px] font-semibold text-text-primary">{title} settings</h2><p className="mt-1 text-[14px] leading-relaxed text-text-secondary">{description}</p></div>
              <Component />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
