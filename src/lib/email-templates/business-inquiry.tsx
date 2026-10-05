import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  businessName?: string
  businessType?: string
  contactName?: string
  email?: string
  message?: string
  submittedAt?: string
  address?: string
}

const BusinessInquiryEmail = ({ businessName = '', businessType = '', contactName = '', email = '', message = '', submittedAt = '', address = '' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New business inquiry from {businessName}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#1e47a8', margin: '0 0 16px' }}>New business inquiry</Heading>
        <Text style={row}><b>Business:</b> {businessName}</Text>
        <Text style={row}><b>Type:</b> {businessType}</Text>
        <Text style={row}><b>Name:</b> {contactName || '(none)'}</Text>
        <Text style={row}><b>Work email:</b> {email}</Text>
        <Text style={row}><b>Address:</b> {address || '(none)'}</Text>
        <Text style={row}><b>Submitted:</b> {submittedAt}</Text>
        <Hr />
        <Text style={{ fontSize: '15px', color: '#111', whiteSpace: 'pre-wrap' }}>{message || '(No message)'}</Text>
        <Hr />
        <Button href="https://huri.team/business-onboarding-admin" style={{ backgroundColor: '#1e47a8', color: '#ffffff', padding: '12px 18px', borderRadius: '10px', fontSize: '14px' }}>
          Open Business Onboarding in Huri
        </Button>
        <Text style={{ fontSize: '12px', color: '#666' }}>Manage this inquiry from Business Onboarding in Huri so its records stay up to date.</Text>
      </Container>
    </Body>
  </Html>
)

const row = { fontSize: '14px', color: '#333', margin: '0 0 6px' }

const label = (t?: string) => (t === 'auction' ? 'Auction' : 'Dealership')

export const template = {
  component: BusinessInquiryEmail,
  subject: (d: Record<string, any>) => `[Huri Business] New ${label(d.businessType)} inquiry from ${d.businessName ?? ''}`,
  displayName: 'New business inquiry',
  to: 'aron@huri.team',
  previewData: { businessName: 'Sunset Motors', businessType: 'Dealership', contactName: 'Sam Rivera', email: 'gm@sunset.com', message: 'Two lots and a wash bay.', submittedAt: 'Oct 5, 2026 10:30 AM' },
} satisfies TemplateEntry
