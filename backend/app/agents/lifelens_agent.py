"""LifeLens multi-agent journal system built with Google ADK."""

from google.adk import Agent

from app.agents.prompts import (
    AGENT_NAME,
    ARCHIVE_AGENT_NAME,
    BRAINSTORM_AGENT_NAME,
    CALENDAR_AGENT_NAME,
    COORDINATOR_NAME,
    DATETIME_AGENT_NAME,
    REFLECTION_AGENT_NAME,
    SUMMARY_AGENT_NAME,
    agent_instruction,
    coordinator_instruction,
)
from app.agents.tools import (
    create_calendar_event,
    format_bullet_summary,
    get_current_datetime,
    prepare_journal_archive,
    suggest_reflection_prompts,
)

# Re-export for ADK session bootstrap (coordinator name).
__all__ = ["AGENT_NAME", "create_lifelens_agent"]


def create_lifelens_agent(model: str) -> Agent:
    """Build the LifeLens coordinator with specialist sub-agents and tools."""
    datetime_agent = Agent(
        name=DATETIME_AGENT_NAME,
        model=model,
        mode="task",
        description=(
            "Establishes the user's current local date and time before calendar, archive, "
            "or any journaling that involves relative dates like yesterday or tomorrow."
        ),
        instruction=agent_instruction("datetime_agent"),
        tools=[get_current_datetime],
    )

    reflection_agent = Agent(
        name=REFLECTION_AGENT_NAME,
        model=model,
        mode="chat",
        description=(
            "Default journaling mode. Asks about the user's day, listens deeply, "
            "and helps them reflect on thoughts and feelings."
        ),
        instruction=agent_instruction("reflection_agent"),
        tools=[get_current_datetime],
    )

    archive_agent = Agent(
        name=ARCHIVE_AGENT_NAME,
        model=model,
        mode="task",
        description=(
            "Archives the full conversation to the user's journal when they ask to save, "
            "store, or archive their reflection."
        ),
        instruction=agent_instruction("archive_agent"),
        tools=[get_current_datetime, prepare_journal_archive],
    )

    calendar_agent = Agent(
        name=CALENDAR_AGENT_NAME,
        model=model,
        mode="task",
        description=(
            "Creates Google Calendar events when the user mentions a date, time, "
            "schedule, reminder, or asks to mark something on their calendar."
        ),
        instruction=agent_instruction("calendar_agent"),
        tools=[get_current_datetime, create_calendar_event],
    )

    summary_agent = Agent(
        name=SUMMARY_AGENT_NAME,
        model=model,
        mode="task",
        description=(
            "Summarizes the complete journal session into clear bullet points "
            "when the user asks for a recap."
        ),
        instruction=agent_instruction("summary_agent"),
        tools=[get_current_datetime, format_bullet_summary],
    )

    brainstorm_agent = Agent(
        name=BRAINSTORM_AGENT_NAME,
        model=model,
        mode="chat",
        description=(
            "Brainstorm mode. Gently helps the user explore ideas and possibilities "
            "around their thoughts."
        ),
        instruction=agent_instruction("brainstorm_agent"),
    )

    coordinator = Agent(
        name=COORDINATOR_NAME,
        model=model,
        description=(
            "LifeLens journal coordinator. Routes reflection, brainstorm, archiving, "
            "calendar, and session summaries."
        ),
        instruction=coordinator_instruction(),
        tools=[suggest_reflection_prompts, get_current_datetime],
        sub_agents=[
            datetime_agent,
            reflection_agent,
            archive_agent,
            calendar_agent,
            summary_agent,
            brainstorm_agent,
        ],
    )

    return coordinator
