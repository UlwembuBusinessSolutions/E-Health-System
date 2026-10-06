export interface Facility {
  id: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // Matches the roles seeded per tenant (backend-auth-guide.html Section 3)
  // — "ORG_ADMIN" is the one this frontend currently checks for; other role
  // names pass through unused until staff-facing screens exist.
  role: string;
}
