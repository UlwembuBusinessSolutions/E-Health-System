import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ListChecks, PackagePlus, Plus } from "lucide-react";
import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { LinkButton } from "../stock/LinkButton";
import { useFacilitySelection } from "../stock/useFacilitySelection";
import { ProductForm } from "./ProductForm";

// Route: /app/pharmacy/products/new  (?copyFrom=<productId>&facilityId=<id>)
export function AddProductPage() {
  const [searchParams] = useSearchParams();
  const { facilities, facilityId, selectFacility } = useFacilitySelection();
  const [created, setCreated] = useState<PharmacyProduct | null>(null);
  // Bumped by "Add another" so the form remounts empty.
  const [formKey, setFormKey] = useState(0);
  const copyFrom = searchParams.get("copyFrom") ?? undefined;
  const facilityQuery = `?facilityId=${facilityId}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <LinkButton to={`/app/pharmacy/stock${facilityQuery}`} icon={<ArrowLeft className="size-4" aria-hidden />}>
          Back to stock
        </LinkButton>
      </div>

      {created ? (
        <CreatedSummary
          product={created}
          receiveTo={`/app/pharmacy/receive${facilityQuery}`}
          stockTo={`/app/pharmacy/stock${facilityQuery}`}
          onAddAnother={() => {
            setCreated(null);
            setFormKey((key) => key + 1);
          }}
        />
      ) : (
        <>
          <PageHeader title="Add product" description="Set up a product for your facility. Receive stock when you're ready." />
          {facilities.length > 1 && (
            <div className="mb-4 sm:w-64">
              <Select
                label="Facility"
                options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
                value={facilityId}
                onChange={(event) => selectFacility(event.target.value)}
              />
            </div>
          )}
          {facilityId && (
            <ProductForm
              key={`${formKey}-${facilityId}`}
              variant="page"
              facilityId={facilityId}
              copyFromProductId={formKey === 0 ? copyFrom : undefined}
              onCreated={setCreated}
            />
          )}
        </>
      )}
    </div>
  );
}

interface CreatedSummaryProps {
  product: PharmacyProduct;
  receiveTo: string;
  stockTo: string;
  onAddAnother: () => void;
}

function CreatedSummary({ product, receiveTo, stockTo, onAddAnother }: CreatedSummaryProps) {
  return (
    <Card className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 p-8 text-center">
      <CheckCircle2 className="size-10 text-success-500" aria-hidden />
      <h1 role="status" className="text-[22px] font-semibold text-text-primary">
        {product.displayName} added
      </h1>
      <p className="text-[14px] text-text-secondary">
        <span className="font-mono">{product.code}</span> is in the catalog and in this facility's range. It has no stock
        yet, so it shows as out of stock until you receive some.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <LinkButton variant="primary" to={receiveTo} icon={<PackagePlus className="size-4" aria-hidden />}>
          Receive first stock
        </LinkButton>
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={onAddAnother}>
          Add another product
        </Button>
        <LinkButton to={stockTo} icon={<ListChecks className="size-4" aria-hidden />}>
          Back to stock
        </LinkButton>
      </div>
    </Card>
  );
}
