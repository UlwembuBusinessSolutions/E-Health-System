import type { CountScope, StartCountPayload } from "@/shared/api/pharmacyCounts";

/** What the person has picked on the set-up step, before a count exists. */
export interface ScopeChoice {
  scope: CountScope;
  areaLabel: string;
  productName: string;
}

export const INITIAL_SCOPE: ScopeChoice = { scope: "ALL", areaLabel: "", productName: "" };

/** A shelf area or a product is useless until it is named. */
export function isScopeComplete(choice: ScopeChoice): boolean {
  if (choice.scope === "AREA") return choice.areaLabel !== "";
  if (choice.scope === "PRODUCT") return choice.productName !== "";
  return true;
}

export function toStartPayload(choice: ScopeChoice, facilityId: string, blind: boolean): StartCountPayload {
  return {
    facilityId,
    scope: choice.scope,
    areaLabel: choice.scope === "AREA" ? choice.areaLabel : undefined,
    productQuery: choice.scope === "PRODUCT" ? choice.productName : undefined,
    blind,
  };
}
