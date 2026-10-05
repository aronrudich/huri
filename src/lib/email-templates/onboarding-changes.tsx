import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { link?: string; businessName?: string; message?: string }

const Email = ({ link = '#', businessName = '', message = '' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A few changes are needed on your Huri property map</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '22px', color: '#1e47a8', margin: '0 0 16px' }}>A few map changes needed</Heading>
        <Text style={{ fontSize: '15px', color: '#222', lineHeight: '22px' }}>
          Thanks for mapping {businessName || 'your property'}. Huri reviewed it and needs a few updates before activating your company:
        </Text>
        <Text style={{ fontSize: '15px', color: '#222', lineHeight: '22px', whiteSpace: 'pre-wrap', backgroundColor: '#f2f5fb', padding: '12px', borderRadius: '8px' }}>{message}</Text>
        <Button href={link} style={{ backgroundColor: '#1e47a8', color: '#ffffff', padding: '14px 22px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold' }}>
          Update my map
        </Button>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#666' }}>This secure link replaces any earlier onboarding link. Please do not forward it.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Huri: a few changes needed on your property map',
  displayName: 'Onboarding changes requested',
  previewData: { link: 'https://huri.team/business-onboarding/example', businessName: 'Sunset Motors', message: 'Please add the back lot.' },
} satisfies TemplateEntry
