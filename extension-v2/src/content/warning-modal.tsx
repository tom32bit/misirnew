/**
 * Warning Modal - shown before capturing AI chat conversations
 * Warns user that ALL messages will be captured including other participants
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, CheckCircle, X, MessageSquare } from 'lucide-react'
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
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          margin: 24,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          animation: 'misirModalIn 0.2s ease-out',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes misirModalIn {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `
        }} />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '20px 24px 16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderBottom: '1px solid #fcd34d',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              background: '#f59e0b',
              borderRadius: 10,
              color: 'white',
            }}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1f2937' }}>
              Save entire conversation?
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#92400e' }}>
              {config?.displayName || 'This conversation'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 16,
              background: '#fefce8',
              border: '1px solid #fde047',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <MessageSquare className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div style={{ fontSize: 14, lineHeight: 1.5, color: '#78350f' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                This will save <strong>ALL messages</strong> in this conversation.
              </p>
              <p style={{ margin: '8px 0 0' }}>
                This includes messages from <strong>other participants</strong>. Only proceed if:
              </p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
                <li>You have their consent, OR</li>
                <li>This is your personal conversation</li>
              </ul>
            </div>
          </div>

          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 12px' }}>
              Your content is processed on-device with PII redaction before upload.
              Capture is governed by your Misir consent settings.
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <a
                href="https://misir.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: config?.color || '#3b82f6', textDecoration: 'underline' }}
              >
                Read our Privacy Policy →
              </a>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '16px 24px 20px',
            borderTop: '1px solid #e5e7eb',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              background: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb'
              e.currentTarget.style.borderColor = '#9ca3af'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>

          <button
            onClick={onProceed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              background: config?.color || '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(0.95)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <CheckCircle className="w-4 h-4" />
            Save Conversation
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