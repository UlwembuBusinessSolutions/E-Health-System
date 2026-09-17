import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface Department { id: string; facilityId: string; name: string }
export interface ServiceStation { id: string; facilityId: string; departmentId: string | null; name: string; counterLabel: string | null }
const headers = { headers: tenantAuthHeaders() };
export async function listDepartments(facilityId: string) {
  return (await apiClient.get<{items: Department[]}>(`/api/v1/facilities/${facilityId}/configuration/departments`, headers)).items;
}
export async function createDepartment(facilityId: string, name: string) {
  return apiClient.post<Department>(`/api/v1/facilities/${facilityId}/configuration/departments`, { name }, headers);
}
export async function deleteDepartment(facilityId: string, id: string) {
  return apiClient.delete<void>(`/api/v1/facilities/${facilityId}/configuration/departments/${id}`, headers);
}
export async function listStations(facilityId: string) {
  return (await apiClient.get<{items: ServiceStation[]}>(`/api/v1/facilities/${facilityId}/configuration/stations`, headers)).items;
}
export async function createStation(facilityId: string, payload: {name: string; departmentId?: string; counterLabel?: string}) {
  return apiClient.post<ServiceStation>(`/api/v1/facilities/${facilityId}/configuration/stations`, payload, headers);
}
export async function deleteStation(facilityId: string, id: string) {
  return apiClient.delete<void>(`/api/v1/facilities/${facilityId}/configuration/stations/${id}`, headers);
}
