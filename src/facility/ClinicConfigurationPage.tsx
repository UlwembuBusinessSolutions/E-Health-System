import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { getFacilities } from "@/shared/api/facilities";
import { createDepartment, createStation, deleteDepartment, deleteStation, listDepartments, listStations } from "@/shared/api/clinicConfiguration";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";

export function ClinicConfigurationPage() {
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const facilityId = facilities.data?.[0]?.id ?? "";
  const qc = useQueryClient();
  const departments = useQuery({ queryKey: ["departments", facilityId], queryFn: () => listDepartments(facilityId), enabled: !!facilityId });
  const stations = useQuery({ queryKey: ["stations", facilityId], queryFn: () => listStations(facilityId), enabled: !!facilityId });
  const [department, setDepartment] = useState(""); const [station, setStation] = useState(""); const [counter, setCounter] = useState(""); const [stationDepartment, setStationDepartment] = useState(""); const [error, setError] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["departments", facilityId] }); qc.invalidateQueries({ queryKey: ["stations", facilityId] }); };
  const failure = (e: unknown) => setError(e instanceof ApiError ? `${e.status === 409 ? "Cannot remove: " : ""}${e.message}` : "Request failed");
  const addDepartment = useMutation({ mutationFn: () => createDepartment(facilityId, department), onSuccess: () => { setDepartment(""); refresh(); }, onError: failure });
  const addStation = useMutation({ mutationFn: () => createStation(facilityId, { name: station, departmentId: stationDepartment || undefined, counterLabel: counter || undefined }), onSuccess: () => { setStation(""); setCounter(""); setStationDepartment(""); refresh(); }, onError: failure });
  const remove = useMutation({ mutationFn: ({id, kind}: {id: string; kind: "department"|"station"}) => kind === "station" ? deleteStation(facilityId,id) : deleteDepartment(facilityId,id), onSuccess: refresh, onError: failure });
  return <div><PageHeader title="Clinic configuration" description="Configure departments, service stations and counters for your clinic." />
    {error && <div role="alert" className="mb-4 rounded-lg bg-danger-50 p-3 text-danger-600">{error}</div>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><h2 className="mb-4 font-semibold">Departments</h2><div className="flex gap-2"><Input label="New department" value={department} onChange={e=>setDepartment(e.target.value)} /><Button type="button" onClick={()=>addDepartment.mutate()} disabled={!department.trim()}>Add</Button></div>
        <ul className="mt-4 space-y-2">{(departments.data??[]).map(d=><li className="flex justify-between border-b py-2" key={d.id}>{d.name}<button className="text-danger-600" onClick={()=>remove.mutate({id:d.id,kind:"department"})}>Remove</button></li>)}</ul></Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">Service stations & counters</h2><div className="grid gap-2"><Input label="Station name" value={station} onChange={e=>setStation(e.target.value)} /><Select label="Department (optional)" options={(departments.data??[]).map(d=>({value:d.id,label:d.name}))} value={stationDepartment} onChange={e=>setStationDepartment(e.target.value)} /><Input label="Counter label (optional)" value={counter} onChange={e=>setCounter(e.target.value)} /><Button type="button" onClick={()=>addStation.mutate()} disabled={!station.trim()}>Add station</Button></div>
        <ul className="mt-4 space-y-2">{(stations.data??[]).map(s=><li className="flex justify-between border-b py-2" key={s.id}><span>{s.name}{s.counterLabel ? ` · ${s.counterLabel}` : ""}</span><button className="text-danger-600" onClick={()=>remove.mutate({id:s.id,kind:"station"})}>Remove</button></li>)}</ul></Card>
    </div></div>;
}
