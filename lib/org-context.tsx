"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import { fetchClient } from "./fetch-client";

interface Organization {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  description: string | null;
  logo: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, isOrgAdmin, getOrganizationId, isLoading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    const orgId = getOrganizationId();
    
    // Only fetch if user is org admin and has an organization ID
    if (!isOrgAdmin() || !orgId) {
      setOrganization(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchClient<Organization>(`/api/organizations/${orgId}`);
      setOrganization(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch organization");
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before fetching org
    if (!authLoading && user) {
      fetchOrganization();
    } else if (!authLoading && !user) {
      setOrganization(null);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const refetch = async () => {
    await fetchOrganization();
  };

  return (
    <OrganizationContext.Provider
      value={{ organization, isLoading, error, refetch }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
