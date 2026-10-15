import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil } from "lucide-react";
import { createFacility, updateFacility, getManagedFacilities, type FacilityDetails } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

const schema = z.object({
  name: z.string().trim().min(1, "Facility name is required").max(200),
  code: z.string().trim().min(1, "Facility code is required").max(20),
  type: z.enum(["CLINIC", "HOSPITAL", "STORE", "PHARMACY"]),
  address: z.string().trim().max(300), phone: z.string().trim().max(20), operatingHours: z.string().trim().max(200),
});
type Values = z.infer<typeof schema>;
const types = [{ value: "CLINIC", label: "Clinic" }, { value: "HOSPITAL", label: "Hospital" }, { value: "STORE", label: "Store" }, { value: "PHARMACY", label: "Pharmacy" }];
const queryKey = ["organization", "managed-facilities"];

export function FacilitiesSettingsSection() {
  const query = useQuery({ queryKey, queryFn: getManagedFacilities });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FacilityDetails | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const facilities = (query.data ?? []).filter(facility => `${facility.name} ${facility.code} ${facility.type}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  if (editing) return <FacilityForm key={editing === "new" ? "new" : editing.id} facility={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSaved={facility => { setNotice(`${facility.name} saved.`); setSearch(""); setEditing(null); }} />;
  return <div className="space-y-4">
    {notice && <p role="status" className="rounded-lg bg-brand-50 p-3 text-[14px] text-brand-700">{notice}</p>}
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-5"><div><h3 className="font-semibold text-text-primary">Your facilities</h3><p className="mt-1 text-[13px] text-text-secondary">Manage the places where your organization provides services.</p></div><Button icon={<Plus className="size-4" aria-hidden />} onClick={() => { setNotice(""); setEditing("new"); }}>Add facility</Button></div>
      {query.isPending ? <p role="status" className="p-6 text-text-secondary">Loading facilities…</p> : query.isError ? <div role="alert" className="space-y-3 p-6"><p>Facilities could not be loaded.</p><Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>Retry</Button></div> : <>
        <div className="p-5"><Input label="Search facilities" type="search" placeholder="Search by name, code or type" value={search} onChange={event => setSearch(event.target.value)} /></div>
        {facilities.length === 0 ? <div className="px-6 pb-8 text-center"><Building2 className="mx-auto mb-3 size-8 text-text-secondary" aria-hidden /><p className="font-medium text-text-primary">{query.data?.length ? "No matching facilities" : "No facilities yet"}</p><p className="mt-1 text-[13px] text-text-secondary">{query.data?.length ? "Try a different name, code or type." : "Add your first facility to make it available for staff and visits."}</p>{search && <Button variant="ghost" onClick={() => setSearch("")}>Clear search</Button>}</div> : <ul className="divide-y divide-border-subtle">
          {facilities.map(facility => <li key={facility.id} className="p-5"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Building2 className="size-5" aria-hidden /></span><div className="min-w-0 flex-1"><h4 className="break-words text-[15px] font-semibold text-text-primary">{facility.name}</h4><p className="mt-1 break-words text-[12px] text-text-secondary"><span className="font-mono">{facility.code}</span> · {types.find(type => type.value === facility.type)?.label ?? facility.type} · {facility.active ? "Active" : "Inactive"}</p></div><Button variant="ghost" aria-label={`Edit ${facility.name}`} icon={<Pencil className="size-4" aria-hidden />} onClick={() => { setNotice(""); setEditing(facility); }}>Edit</Button></div>
            <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">{[["Address", facility.address], ["Contact number", facility.phone], ["Operating hours", facility.operatingHours]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-[12px] text-text-secondary">{label}</dt><dd className="mt-0.5 break-words text-text-primary">{value}</dd></div>)}</dl>
          </li>)}
        </ul>}
        <p className="border-t border-border-subtle px-5 py-3 text-[12px] text-text-secondary">{facilities.length} of {query.data?.length ?? 0} facilities</p>
      </>}
    </Card>
  </div>;
}

function FacilityForm({ facility, onCancel, onSaved }: { facility?: FacilityDetails; onCancel: () => void; onSaved: (facility: FacilityDetails) => void }) {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: facility?.name ?? "", code: facility?.code ?? "", type: facility?.type ?? "CLINIC", address: facility?.address ?? "", phone: facility?.phone ?? "", operatingHours: facility?.operatingHours ?? "" } });
  const mutation = useMutation({
    mutationFn: (values: Values) => facility ? updateFacility(facility.id, values) : createFacility(values),
    onSuccess: updated => {
      client.setQueryData<FacilityDetails[]>(queryKey, current => [...(current ?? []).filter(item => item.id !== updated.id), updated]);
      void client.invalidateQueries({ queryKey });
      void client.invalidateQueries({ queryKey: ["facilities"] });
      void client.invalidateQueries({ queryKey: ["patients"] });
      onSaved(updated);
    },
    onError: error => setError(error instanceof ApiError ? error.message : "Could not save the facility. Please try again."),
  });
  return <Card className="p-5 sm:p-6"><div className="mb-5"><h3 className="text-[17px] font-semibold text-text-primary">{facility ? "Edit facility" : "Add facility"}</h3><p className="mt-1 text-[13px] text-text-secondary">{facility ? "Update this facility's details. Its existing records stay linked." : "Create a facility for your organization."}</p></div>
    <form noValidate onSubmit={handleSubmit(values => { setError(""); mutation.mutate(values); })} className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-[14px] text-danger-600">{error}</p>}
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
        <FormRow><Input label="Facility name" required maxLength={200} autoFocus error={errors.name?.message} {...register("name")} /><Input label="Facility code" required maxLength={20} hint="Unique within your organization." error={errors.code?.message} {...register("code")} /></FormRow>
        <Select label="Facility type" required options={types} error={errors.type?.message} {...register("type")} />
        <Input label="Physical address" maxLength={300} error={errors.address?.message} {...register("address")} />
        <FormRow><Input label="Contact number" type="tel" maxLength={20} error={errors.phone?.message} {...register("phone")} /><Input label="Operating hours" maxLength={200} placeholder="Mon–Fri 07:00–16:00" error={errors.operatingHours?.message} {...register("operatingHours")} /></FormRow>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4"><Button variant="secondary" type="button" disabled={mutation.isPending} onClick={onCancel}>Cancel</Button><Button type="submit" loading={mutation.isPending} disabled={!!facility && !isDirty}>{facility ? "Save facility" : "Create facility"}</Button></div>
    </form>
  </Card>;
}
