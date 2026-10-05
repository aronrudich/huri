import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { businessName?: string; code?: string }

const Email = ({ businessName = '', code = '' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Huri company is ready</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '22px', color: '#1e47a8', margin: '0 0 16px' }}>{businessName || 'Your company'} is ready in Huri</Heading>
        <Text style={{ fontSize: '15px', color: '#222', lineHeight: '22px' }}>Your Huri company setup is complete. Your permanent company code is:</Text>
        <Text style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '3px', color: '#1e47a8', margin: '8px 0 16px' }}>{code}</Text>
        <Text style={{ fontSize: '15px', color: '#222', lineHeight: '22px' }}>
          Employees can now create their own Huri accounts with this code. Share it only with authorized employees — new accounts still need management approval.
        </Text>
        <Button href="https://huri.team/auth" style={{ backgroundColor: '#1e47a8', color: '#ffffff', padding: '14px 22px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold' }}>
          Open Huri
        </Button>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#666' }}>No account or password was created for you. Each person signs up on their own.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your Huri company code for ${d.businessName ?? 'your business'}`,
  displayName: 'Company activated',
  previewData: { businessName: 'Sunset Motors', code: 'K7QM4XR2' },
} satisfies TemplateEntry
