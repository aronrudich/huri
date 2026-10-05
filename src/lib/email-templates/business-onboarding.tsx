import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { link?: string; businessName?: string }

const OnboardingEmail = ({ link = '#', businessName = '' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Set up {businessName || 'your business'} in Huri</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '22px', color: '#1e47a8', margin: '0 0 16px' }}>Let's map your property</Heading>
        <Text style={{ fontSize: '15px', color: '#222', lineHeight: '22px' }}>
          Huri uses a digital map of your property to help your team locate vehicles quickly. Use the secure link below to confirm your business address, outline the property, and identify each lot.
        </Text>
        <Button href={link} style={{ backgroundColor: '#1e47a8', color: '#ffffff', padding: '14px 22px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold' }}>
          Start Onboarding
        </Button>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#666', lineHeight: '18px' }}>
          This link is unique to your business. Please do not forward it. Creating this map does not create an employee account. Huri will review the information before activating your company.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OnboardingEmail,
  subject: 'Set up your business in Huri',
  displayName: 'Business onboarding link',
  previewData: { link: 'https://huri.team/business-onboarding/example', businessName: 'Sunset Motors' },
} satisfies TemplateEntry
