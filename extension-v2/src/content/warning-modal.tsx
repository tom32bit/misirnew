/**
 * Warning Modal - shown before capturing AI chat conversations
 * Warns user that ALL messages will be captured including other participants
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { PlatformType } from '@/lib/types'
import { PLATFORM_CONFIG } from './platform-detector'

interface WarningModalProps {
  platform: PlatformType
  onProceed: () => void
  onCancel: () => void
}

export function WarningModal({ platform, onProceed, onCancel }: WarningModalProps) {
  const config = PLATFORM_CONFIG[platform]

  React.useEffect(() => {
    // Trap focus
    const modal = document.getElementById('misir-warning-modal')
    const focusableElements = modal?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements?.[0] as HTMLElement
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement

    firstElement?.focus()

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [])

  React.useEffect(() => {
    // Close on Escape
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div
      id="misir-warning-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 9, 8, 0.6)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />

      {/* Modal — Claude dark, matching the extension's popup/options */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          margin: 24,
          background: '#262625',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          boxShadow: '0 28px 70px -14px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: 'misirModalIn 0.2s ease-out',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes misirModalIn {
              from { opacity: 0; transform: scale(0.96) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '24px 24px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              background: 'rgba(217,119,87,0.16)',
              borderRadius: 11,
              color: '#E0906F',
              flexShrink: 0,
            }}
          >
            <AlertTriangle style={{ width: 19, height: 19 }} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#F5F4EF',
              }}
            >
              Save entire conversation?
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#91918C' }}>
              {config?.displayName || 'This conversation'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '18px 24px 4px' }}>
          <div
            style={{
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderLeft: '3px solid #D97757',
              borderRadius: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: '#EDEBE6' }}>
              This saves <strong>every message</strong> in the conversation — including
              those from <strong>other participants</strong>.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: '#AFACA4' }}>
              Only continue if it&apos;s your own conversation, or you have their consent.
            </p>
          </div>

          <p style={{ margin: '16px 2px 0', fontSize: 13, lineHeight: 1.6, color: '#91918C' }}>
            Processed on-device with PII redaction before upload, per your Misir consent
            settings.{' '}
            <a
              href="https://misir.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#E0906F',
                textDecoration: 'none',
                fontWeight: 500,
                borderBottom: '1px solid rgba(224,144,111,0.35)',
              }}
            >
              Privacy Policy →
            </a>
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, padding: '18px 24px 22px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              color: '#C4C3BD',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'
            }}
          >
            Cancel
          </button>

          <button
            onClick={onProceed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 18px',
              background: '#D97757',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#CB6A4A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#D97757'
            }}
          >
            <CheckCircle style={{ width: 15, height: 15 }} />
            Save conversation
          </button>
        </div>
      </div>
    </div>
  )
}

let modalRoot: ReturnType<typeof createRoot> | null = null
let modalContainer: HTMLDivElement | null = null

export function showWarningModal(
  platform: PlatformType,
  onProceed: () => void,
  onCancel: () => void
): void {
  if (modalContainer) return

  modalContainer = document.createElement('div')
  modalContainer.id = 'misir-warning-modal-container'
  document.documentElement.appendChild(modalContainer)

  modalRoot = createRoot(modalContainer)
  modalRoot.render(
    <WarningModal platform={platform} onProceed={onProceed} onCancel={onCancel} />
  )
}

export function hideWarningModal(): void {
  if (modalRoot) {
    modalRoot.unmount()
    modalRoot = null
  }
  if (modalContainer) {
    modalContainer.remove()
    modalContainer = null
  }
}