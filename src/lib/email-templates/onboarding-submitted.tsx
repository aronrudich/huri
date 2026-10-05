import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { businessName?: string; businessType?: string; inquiryId?: string; lots?: number; spots?: number }

const Email = ({ businessName = '', businessType = '', inquiryId = '', lots = 0, spots = 0 }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{businessName} submitted their property map</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#1e47a8', margin: '0 0 16px' }}>Property map ready for review</Heading>
        <Text style={row}><b>Business:</b> {businessName}</Text>
        <Text style={row}><b>Type:</b> {businessType}</Text>
        <Text style={row}><b>Lots / spots:</b> {lots} / {spots}</Text>
        <Text style={row}><b>Inquiry:</b> {inquiryId}</Text>
        <Button href={`https://huri.team/business-onboarding-review/${inquiryId}`} style={{ backgroundColor: '#1e47a8', color: '#ffffff', padding: '12px 18px', borderRadius: '10px', fontSize: '14px' }}>
          Review map in Huri
        </Button>
      </Container>
    </Body>
  </Html>
)
const row = { fontSize: '14px', color: '#333', margin: '0 0 6px' }

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[Huri Business] Map submitted: ${d.businessName ?? ''}`,
  displayName: 'Onboarding map submitted',
  to: 'aron@huri.team',
  previewData: { businessName: 'Sunset Motors', businessType: 'Dealership', inquiryId: '00000000-0000-0000-0000-000000000000', lots: 3, spots: 120 },
} satisfies TemplateEntry
