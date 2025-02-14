import { useState, useEffect } from "react";

interface Organization {
  organizationId: string;
  organizationName: string;
  upperLevelOrgId: string;
  memo: string;
}

interface Contact {
  contactId: string;
  lastName: string;
  firstName: string;
  organizationId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
}

const useSalesData = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const orgResponse = await fetch("/local-database/organizations.json");
        const contactResponse = await fetch("/local-database/contacts.json");
        
        if (!orgResponse.ok || !contactResponse.ok) {
          throw new Error("Failed to fetch data");
        }
        
        const orgData: Organization[] = await orgResponse.json();
        const contactData: Contact[] = await contactResponse.json();

        setOrganizations(orgData);
        setContacts(contactData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { organizations, contacts, isLoading, error };
};

export default useSalesData;
