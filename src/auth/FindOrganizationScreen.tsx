import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { findOrganizationSchema, type FindOrganizationValues } from "./validation";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";

// What a bare /login (bookmarked, hand-typed, or a stale link) actually
// renders — this app has no tenant-picker dropdown (there's no endpoint
// listing organisations to an unauthenticated visitor, nor should there
// be), so the only way in is knowing your own organisation's slug and
// typing it once here. Every real sign-in happens at /org/:tenantSlug/login
// after this redirects there; this screen itself never calls the API.
export function FindOrganizationScreen() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FindOrganizationValues>({
    resolver: zodResolver(findOrganizationSchema),
    defaultValues: { tenantSlug: "" },
  });

  const onSubmit = ({ tenantSlug }: FindOrganizationValues) => {
    navigate(`/org/${tenantSlug}/login`);
  };

  return (
    <AuthLayout title="Find your organisation" subtitle="Enter the slug your organisation was provisioned with.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields flex flex-col gap-4">
        <Input
          label="Organization"
          required
          icon={<Building2 className="size-4" aria-hidden />}
          placeholder="riverbend-health"
          hint="The slug used when this organization was provisioned"
          autoComplete="off"
          autoFocus
          error={errors.tenantSlug?.message}
          {...register("tenantSlug")}
        />
        <Button type="submit" size="lg" className="mt-1 w-full">
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
