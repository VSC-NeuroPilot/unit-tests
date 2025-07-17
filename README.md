# NeuroPilot Unit Test Coverage

Somewhat needlessly complex site that displays unit test coverage.

## How does it work?

Using [`VSC-NeuroPilot/actions/send-test-repo-action`](https://github.com/VSC-NeuroPilot/actions/tree/main/send-test-repo-action), unit test reports in HTML by Mocha are uploaded and sent to this repository, where it gets integrated into the repository. This then gets built by Vite and uploaded to GitHub Pages.

Here's a flow"chart" that shows how it works:

```md

[NeuroPilot repository completes unit test via CI] --> [Mocha spawns built site] --> [Other repo's CI run triggers the action] --> [Action uploads site as artifact] --> [Action calls the integration workflow and exits] --> [Workflow downloads the new artifact(s) and unzips them] --> [Workflow installs npm dependencies] --> [Workflow calls the build command, which activates custom plugins] --> [Final build output is uploaded to GitHub Pages]

```
