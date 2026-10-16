# Automation identity: GitHub Actions or PulseStatusBot

PulseStatus can use the default `GITHUB_TOKEN` or an installed GitHub App for Issue creation, Issue updates, monitoring-state commits, and other GitHub API operations.

## Default behavior

If no repository variable or App credentials are provided, the workflow uses the built-in `github-actions` identity. This is the safest zero-configuration mode and is the default.

The workflow uses the App only when all three conditions are true:

1. Repository or organization variable `PULSE_BOT_MODE` is `app`.
2. Secret `PULSE_APP_ID` is present.
3. Secret `PULSE_APP_PRIVATE_KEY` is present.

If `PULSE_BOT_MODE` is missing, set to `actions`, or App credentials are incomplete, the workflow falls back to `GITHUB_TOKEN`.

If credentials are present but the App is not installed on the target repository, token creation also fails over to `GITHUB_TOKEN` with a workflow warning. The deployment continues, but API actions for that run are performed by `github-actions`.

## Create `PulseStatusBot`

GitHub App creation is an account or organization administration action and cannot be performed by a repository commit. Create it once in the organization that owns the repository:

1. Open **Organization settings → Developer settings → GitHub Apps**.
2. Select **New GitHub App**.
3. Set the name to `PulseStatusBot` (or another organization-approved name).
4. Disable a webhook unless an external webhook receiver is required.
5. Grant the minimum repository permissions:
   - **Contents: Read and write** — persist monitor state commits.
   - **Issues: Read and write** — create and close automated Incidents.
   - **Metadata: Read-only** — required by GitHub.
6. Do not grant administration, Actions write, secrets, deployments, or organization administration permissions.
7. Create the App and record its **App ID**.
8. Generate a private key and download it once. Store it in a password manager; never commit it.
9. Install the App on the organization and select only the `PulseStatus` repository.

The App user will appear in GitHub as `PulseStatusBot[bot]`.

## Add repository or organization settings

Add these repository Secrets under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
| --- | --- |
| `PULSE_APP_ID` | Numeric App ID. |
| `PULSE_APP_PRIVATE_KEY` | Complete PEM private key, including `BEGIN` and `END` lines. |

Add this repository or organization Variable under **Variables**:

| Variable | Value |
| --- | --- |
| `PULSE_BOT_MODE` | `app` |

Do not put the App ID or private key in `config/statuspage.yml`, `config/services.json`, README files, workflow source, or generated public data. The private key is credential material and must stay in an encrypted GitHub Secret.

## Let each user choose their own bot

The workflow does not hard-code the App name. Any repository owner can configure their own GitHub App through the repository settings:

1. Install the chosen App on the exact repository.
2. Add the Actions variable `PULSE_BOT_MODE` with value `app`.
3. Add the Actions secret `PULSE_APP_ID` with that App's numeric ID.
4. Add the Actions secret `PULSE_APP_PRIVATE_KEY` with the complete PEM key.
5. Run the `PulseStatus` workflow manually to verify it.

Organization-level variables and secrets can be used when the same bot should serve multiple repositories. Repository-level values take precedence according to GitHub Actions' normal variable and secret rules.

The user can switch back without a code change:

```text
PULSE_BOT_MODE=actions
```

Alternatively, delete the variable and App secrets. With no valid App configuration, the built-in `GITHUB_TOKEN` is used.

### Settings checklist

| Setting | Location | Required value |
| --- | --- | --- |
| `PULSE_BOT_MODE` | Actions variable | `app` or `actions` |
| `PULSE_APP_ID` | Actions secret | Numeric ID belonging to the selected App |
| `PULSE_APP_PRIVATE_KEY` | Actions secret | Complete PEM private key belonging to the selected App |

Do not enter the private key in the normal repository **Variables** section, because variables are not intended for sensitive credential material.

## Verify the identity

Run the workflow manually after saving the settings. Confirm:

1. The sync step can read Issues.
2. An automated Incident, when triggered, is authored by `PulseStatusBot[bot]`.
3. `public/data/monitor-state.json` commits show the App identity.
4. The Pages deployment still succeeds.

If the App is not installed on the repository, the token step reports a 404 for `/repos/<owner>/<repo>/installation`; install the App on that exact repository and rerun the workflow. If its permissions are too narrow, App-authenticated API calls may fail after token creation. Set `PULSE_BOT_MODE` back to `actions` to restore the default token while correcting the installation.

## Security and rotation

The App token is short-lived and generated at the beginning of each workflow. The private key is not written to disk by the workflow. To rotate it, generate a new key in the App settings, replace `PULSE_APP_PRIVATE_KEY`, run a manual workflow, and revoke the old key only after a successful run.

If the organization requires all automation to use GitHub Actions, leave `PULSE_BOT_MODE` unset and do not create an App. Both modes use the same application behavior and data validation.
