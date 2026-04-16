/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as adminNewRegistration } from './admin-new-registration.tsx'
import { template as adminNewDonation } from './admin-new-donation.tsx'
import { template as adminNewSponsorship } from './admin-new-sponsorship.tsx'
import { template as sponsorLogoUpload } from './sponsor-logo-upload.tsx'
import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as adminNewDinner } from './admin-new-dinner.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-new-registration': adminNewRegistration,
  'admin-new-donation': adminNewDonation,
  'admin-new-sponsorship': adminNewSponsorship,
  'admin-new-dinner': adminNewDinner,
  'sponsor-logo-upload': sponsorLogoUpload,
  'order-confirmation': orderConfirmation,
}
