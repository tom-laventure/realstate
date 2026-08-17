export const SITE_NAME = 'RealtyBase'

export const CTA_URLS = {
  getStarted: 'https://app.realtybase.ca/create',
  login: 'https://app.realtybase.ca/auth/login',
} as const

// Legal pages are canonically hosted in the app (account holders accept them
// at signup there) — link out to them instead of maintaining a second copy
// here that can drift out of sync.
export const LEGAL_LINKS = {
  privacy: 'https://app.realtybase.ca/privacy',
  terms: 'https://app.realtybase.ca/terms',
} as const

export const CONTACT_EMAIL = 'hello@realtybase.ca'
