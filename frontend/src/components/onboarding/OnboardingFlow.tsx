"use client"

import { useReducer, useState } from "react"
import { AnimatePresence } from "motion/react"
import { ObChrome } from "./ObChrome"
import { StepChallenge } from "./StepChallenge"
import { StepOutcome } from "./StepOutcome"
import { StepExtension } from "./StepExtension"
import { SetupOverlay } from "./SetupOverlay"

export type OnboardingDraft = {
  challenge: string
  goal: string
  deadline: Date | undefined
}

type StepId = 1 | 2 | 3

type State = { step: StepId; draft: OnboardingDraft; setup: boolean; withExt: boolean }

type Action =
  | { type: "go"; step: StepId }
  | { type: "patch"; patch: Partial<OnboardingDraft> }
  | { type: "submit"; withExt: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "go":
      return { ...state, step: action.step }
    case "patch":
      return { ...state, draft: { ...state.draft, ...action.patch } }
    case "submit":
      return { ...state, setup: true, withExt: action.withExt }
  }
}

export function OnboardingFlow() {
  const [state, dispatch] = useReducer(reducer, {
    step: 1,
    draft: { challenge: "", goal: "", deadline: undefined },
    setup: false,
    withExt: false,
  })
  // Used to drive AnimatePresence; bumping the key forces step components to
  // unmount-then-remount with their enter animations.
  const [, setKey] = useState(0)

  const go = (step: StepId) => {
    setKey((k) => k + 1)
    dispatch({ type: "go", step })
  }

  const patch = (patch: Partial<OnboardingDraft>) => dispatch({ type: "patch", patch })

  const submit = (withExt: boolean) => dispatch({ type: "submit", withExt })

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--bg)]">
      <ObChrome step={state.step} />

      <div className="flex h-screen items-center justify-center px-6 py-20">
        <AnimatePresence mode="wait">
          {state.step === 1 && (
            <StepChallenge
              key="step-1"
              draft={state.draft}
              onPatch={patch}
              onNext={() => go(2)}
            />
          )}
          {state.step === 2 && (
            <StepOutcome
              key="step-2"
              draft={state.draft}
              onPatch={patch}
              onBack={() => go(1)}
              onNext={() => go(3)}
            />
          )}
          {state.step === 3 && (
            <StepExtension
              key="step-3"
              onBack={() => go(2)}
              onInstall={() => submit(true)}
              onSkip={() => submit(false)}
            />
          )}
        </AnimatePresence>
      </div>

{state.setup && (
        <SetupOverlay draft={state.draft} withExt={state.withExt} />
      )}
    </div>
  )
}
