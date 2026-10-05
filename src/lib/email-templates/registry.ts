import type { ComponentType } from 'react'
import { template as helpRequestTemplate } from './help-request'
import { template as businessInquiryTemplate } from './business-inquiry'
import { template as businessOnboardingTemplate } from './business-onboarding'
import { template as onboardingSubmittedTemplate } from './onboarding-submitted'
import { template as onboardingChangesTemplate } from './onboarding-changes'
import { template as companyActivatedTemplate } from './company-activated'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'help-request': helpRequestTemplate,
  'business-inquiry': businessInquiryTemplate,
  'business-onboarding': businessOnboardingTemplate,
  'onboarding-submitted': onboardingSubmittedTemplate,
  'onboarding-changes': onboardingChangesTemplate,
  'company-activated': companyActivatedTemplate,
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
}
