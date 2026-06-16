import { useState, useEffect } from 'react'

interface LibraryStatus {
  winkNLP: {
    available: boolean
    loading: boolean
    error: string | null
  }
  readability: {
    available: boolean
    loading: boolean
    error: string | null
  }
}

export function useLibraryStatus() {
  const [status, setStatus] = useState<LibraryStatus>({
    winkNLP: { available: false, loading: true, error: null },
    readability: { available: false, loading: true, error: null },
  })

  useEffect(() => {
    async function checkLibraries() {
      // Check Wink NLP - test if it actually works
      try {
        setStatus((prev) => ({
          ...prev,
          winkNLP: { ...prev.winkNLP, loading: true },
        }))
        
        // Dynamically import and test
        const wink = await import('wink-nlp')
        const model = await import('wink-eng-lite-web-model')
        
        // Try to initialize it
        const nlp = wink.default(model.default)
        const doc = nlp.readDoc('test')
        
        // If we got here, it works
        if (doc && nlp) {
          setStatus((prev) => ({
            ...prev,
            winkNLP: { available: true, loading: false, error: null },
          }))
        }
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          winkNLP: {
            available: false,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to initialize',
          },
        }))
      }

      // Check Readability - test if it actually works
      try {
        setStatus((prev) => ({
          ...prev,
          readability: { ...prev.readability, loading: true },
        }))
        
        const { Readability } = await import('@mozilla/readability')
        
        // Try to instantiate it with a mock DOM document
        if (typeof window !== 'undefined' && document) {
          const parser = new Readability(document.cloneNode(true) as Document)
          
          if (parser) {
            setStatus((prev) => ({
              ...prev,
              readability: { available: true, loading: false, error: null },
            }))
          }
        } else {
          // In non-browser environment, just check if it imports
          setStatus((prev) => ({
            ...prev,
            readability: { available: true, loading: false, error: null },
          }))
        }
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          readability: {
            available: false,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to initialize',
          },
        }))
      }
    }

    checkLibraries()
  }, [])

  return status
}
