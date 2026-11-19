import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import { listRoleMfaPolicies, setRoleMfaPolicy, type RoleMfaPolicy } from "@/shared/api/mfa";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

export function MfaPolicySettingsSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const policiesQuery = useQuery({ queryKey: ["admin", "mfa-policies"], queryFn: listRoleMfaPolicies });
  const updatePolicy = useMutation({
    mutationFn: ({ roleId, policy }: { roleId: string; policy: RoleMfaPolicy["policy"] }) =>
      setRoleMfaPolicy(roleId, policy),
    onSuccess: (updated) => {
      queryClient.setQueryData<RoleMfaPolicy[]>(["admin", "mfa-policies"], (current) =>
        current?.map((item) => item.roleId === updated.roleId ? updated : item),
      );
      setError(null);
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Couldn't update the MFA policy. Please try again."),
  });

  if (policiesQuery.isPending) return <p className="text-[14px] text-text-secondary">Loading role policies…</p>;
  if (policiesQuery.isError) {
    return (
      <div className="flex flex-col items-start gap-3 text-[14px] text-text-secondary">
        <p role="alert">MFA policies could not be loaded.</p>
        <Button type="button" variant="secondary" loading={policiesQuery.isFetching} onClick={() => void policiesQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Set MFA to mandatory or optional independently for each role. Enrolled users must verify at sign-in even when their role is optional. Mandatory roles require staff who are not enrolled to set up an authenticator during sign-in.
        </p>
      </Card>
      {error && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{error}</div>}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Role</th>
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">MFA policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {policiesQuery.data.map((item) => (
                <tr key={item.roleId}>
                  <td className="px-5 py-4 text-[14px] font-medium text-text-primary">{item.roleName}</td>
                  <td className="px-5 py-3">
                    <label className="sr-only" htmlFor={`mfa-policy-${item.roleId}`}>MFA policy for {item.roleName}</label>
                    <select
                      id={`mfa-policy-${item.roleId}`}
                      value={item.policy}
                      disabled={updatePolicy.isPending}
                      onChange={(event) => {
                        setError(null);
                        const policy = event.target.value === "MANDATORY" ? "MANDATORY" : "OPTIONAL";
                        updatePolicy.mutate({ roleId: item.roleId, policy });
                      }}
                      className="h-10 min-w-36 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
                    >
                      <option value="OPTIONAL">Optional</option>
                      <option value="MANDATORY">Mandatory</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
