export type ProfilePayload = {
  companyName?: string;
  profile?: {
    description?: string;
    industry?: string;
    website?: string;
    aiNotes?: string;
  };
  audience?: string | null;
  valueProps?: string[];
};
