export interface GalleryPhoto {
  id: string;
  year: number;
  caption: string | null;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

export interface StagedFile {
  id: string;
  file: File;
  preview: string;
}

export const YEARS = [2025, 2024];
