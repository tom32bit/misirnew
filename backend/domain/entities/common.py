"""Shared enums and value objects matching the v2.0 DB schema."""
from enum import Enum


class PlatformType(str, Enum):
    claude = "claude"
    chatgpt = "chatgpt"
    gemini = "gemini"
    perplexity = "perplexity"
    deepseek = "deepseek"
    grok = "grok"
    copilot = "copilot"
    notebooklm = "notebooklm"
    kimi = "kimi"
    web = "web"


class EngagementLevel(str, Enum):
    latent = "latent"
    passive = "passive"
    active = "active"
    deep = "deep"

    @property
    def base_weight(self) -> float:
        return {"latent": 0.2, "passive": 1.0, "active": 2.0, "deep": 3.0}[self.value]

    @property
    def multiplier(self) -> float:
        """Used in confidence blend (§2.4). Clamped at 1.0 for formula."""
        return min(1.0, {"latent": 0.2, "passive": 0.5, "active": 1.0, "deep": 1.5}[self.value])


class GapSeverity(str, Enum):
    Critical = "Critical"
    High = "High"
    Medium = "Medium"

    @property
    def weight(self) -> int:
        return {"Critical": 3, "High": 2, "Medium": 1}[self.value]


class GapStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class NudgeStatus(str, Enum):
    active = "active"
    dismissed = "dismissed"
    acted = "acted"


class CrossLinkStatus(str, Enum):
    suggested = "suggested"
    accepted = "accepted"
    dismissed = "dismissed"


class ReportKind(str, Enum):
    misir_read = "misir_read"
    comparison = "comparison"
    synthesis = "synthesis"
    decision = "decision"


class ReportPeriod(str, Enum):
    today = "today"
    week = "week"
    month = "month"
