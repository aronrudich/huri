import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface HelpRequestProps {
  userName?: string
  role?: string
  dealershipName?: string
  companyCode?: string
  message?: string
}

const HelpRequestEmail = ({
  userName = 'An employee',
  role = '',
  dealershipName = '',
  companyCode = '',
  message = '',
}: HelpRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Huri help message from {userName}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#1e47a8', margin: '0 0 16px' }}>New help message</Heading>
        <Text style={row}><b>Name:</b> {userName}</Text>
        <Text style={row}><b>Role:</b> {role}</Text>
        <Text style={row}><b>Dealership:</b> {dealershipName}</Text>
        <Text style={row}><b>Company code:</b> {companyCode}</Text>
        <Hr />
        <Text style={{ fontSize: '15px', color: '#111', whiteSpace: 'pre-wrap' }}>{message}</Text>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#666' }}>Reply from the Help tab in your Huri account. Replies always show as "Huri".</Text>
      </Container>
    </Body>
  </Html>
)

const row = { fontSize: '14px', color: '#333', margin: '0 0 6px' }

export const template = {
  component: HelpRequestEmail,
  subject: (d: Record<string, any>) => `[Huri Help] New message from ${d.userName ?? 'employee'} (${d.companyCode ?? ''})`,
  displayName: 'Help request',
  to: 'aron@huri.team',
  previewData: { userName: 'Jane Doe', role: 'Advisor', dealershipName: 'JCD', companyCode: 'JCD29854', message: 'The map will not load.' },
} satisfies TemplateEntry
