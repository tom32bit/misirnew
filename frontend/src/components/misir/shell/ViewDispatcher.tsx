"use client"

import { HomeAll } from "@/components/misir/home/HomeAll"
import { HomeSingle } from "@/components/misir/home/HomeSingle"
import { InboxView } from "@/components/misir/inbox/InboxView"
import { NotificationsView } from "@/components/misir/notifications/NotificationsView"
import { CollectionView } from "@/components/misir/collection/CollectionView"
import { ComparisonView } from "@/components/misir/comparison/ComparisonView"
import { DecisionView } from "@/components/misir/decision/DecisionView"
import { SettingsView } from "@/components/misir/settings/SettingsView"

type Scope = "all" | number
type ViewId =
  | "home"
  | "overview"
  | "inbox"
  | "notification"
  | "collection"
  | "comparison"
  | "decision"
  | "settings"

export function ViewDispatcher({ scope, view }: { scope: Scope; view: ViewId }) {
  switch (view) {
    case "home":
      return <HomeAll />
    case "overview":
      return <HomeSingle spaceId={scope as number} />
    case "inbox":
      return <InboxView scope={scope} />
    case "notification":
      return <NotificationsView scope={scope} />
    case "collection":
      return <CollectionView scope={scope} />
    case "comparison":
      return <ComparisonView scope={scope} />
    case "decision":
      return <DecisionView scope={scope} />
    case "settings":
      return <SettingsView scope={scope} />
  }
}
