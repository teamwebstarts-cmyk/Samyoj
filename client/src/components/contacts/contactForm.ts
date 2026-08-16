export type ContactFormValues = {
  phone: string;
  name: string;
  email: string;
  tags: string;
  notes: string;
  customAttributes: string;
  optedIn: boolean;
};

export const emptyContactForm: ContactFormValues = {
  phone: '',
  name: '',
  email: '',
  tags: '',
  notes: '',
  customAttributes: '',
  optedIn: false,
};

export function parseContactTagList(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export type ContactStartPayload = {
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  notes?: string;
  customAttributes?: Record<string, string>;
  optedIn?: boolean;
};
