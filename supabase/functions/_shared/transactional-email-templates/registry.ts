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
import { template as bulkAnnouncement } from './bulk-announcement.tsx'
import { template as auctionWinnerPaid } from './auction-winner-paid.tsx'
import { template as auctionWinnerActionRequired } from './auction-winner-action-required.tsx'
import { template as donationThankYouManual } from './donation-thank-you-manual.tsx'
import { template as eventRecap } from './event-recap.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-new-registration': adminNewRegistration,
  'admin-new-donation': adminNewDonation,
  'admin-new-sponsorship': adminNewSponsorship,
  'admin-new-dinner': adminNewDinner,
  'sponsor-logo-upload': sponsorLogoUpload,
  'order-confirmation': orderConfirmation,
  'bulk-announcement': bulkAnnouncement,
  'auction-winner-paid': auctionWinnerPaid,
  'auction-winner-action-required': auctionWinnerActionRequired,
  'donation-thank-you-manual': donationThankYouManual,
  'event-recap': eventRecap,
}
