name: Postmortem
description: Publish a postmortem for a resolved incident (attach it to the incident body as a ## Postmortem section).
title: "[Postmortem] "
labels:
  - statuspage/incident
body:
  - type: markdown
    attributes:
      value: "Postmortems are rendered on the incident page once the incident is resolved. Add a `## Postmortem` section to the original incident Issue (see the snippet this form produces), or paste it into a comment on the incident Issue — the synchronizer picks up the section from the issue body."
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What happened, in two sentences.
    validations:
      required: true
  - type: textarea
    id: impact
    attributes:
      label: Impact
      description: Which services, how many users, for how long.
    validations:
      required: true
  - type: textarea
    id: root-cause
    attributes:
      label: Root cause
      description: The technical cause, verified after the fact.
    validations:
      required: true
  - type: textarea
    id: resolution
    attributes:
      label: Resolution and follow-ups
      description: What fixed it, and what prevents recurrence.
    validations:
      required: true
  - type: markdown
    attributes:
      value: |
        ## Postmortem

        **Summary**
        <summary>

        **Impact**
        <impact>

        **Root cause**
        <root cause>

        **Resolution and follow-ups**
        <resolution>
