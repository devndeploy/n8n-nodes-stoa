<table align="center" border="0" cellpadding="0" cellspacing="0" style="border: none; border-collapse: collapse;">
  <tr>
    <td align="center" valign="middle" style="border: none; padding: 0;"><img src="icons/stoa.svg" alt="Stoa" height="108"/></td>
    <td align="center" valign="middle" style="border: none; padding: 0 1rem; font-size: 2.5rem; font-weight: 200;">×</td>
    <td align="center" valign="middle" style="border: none; padding: 0;"><img src="icons/n8n.svg" alt="n8n" height="72"/></td>
  </tr>
</table>

# n8n-nodes-stoa

This is an n8n community node. It lets you use [Stoa](https://www.stoa.legal/) in your n8n workflows.

Stoa is legal AI for legal professionals (lawyers, notaries, jurists, …): it
answers legal questions and manages documents using up-to-date legal sources.

[Installation](#installation) · [Nodes](#nodes) · [Credentials](#credentials) · [Compatibility](#compatibility) · [Release](#release) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Nodes

### Stoa Chat Model

Connect **Stoa Chat Model** to n8n's built-in **AI Agent** Chat Model input. The
AI Agent can then use n8n tools and memory normally; Stoa transports tool calls
and tool results through its integration chat API.

Choose any combination of legal categories and Internet. A legal category
activates every Stoa source available to the API-key organization in that
jurisdiction. French Law and Internet are selected by default. Clearing every
source is supported and makes Stoa return a no-source refusal.

### Stoa

The ordinary action node provides:

- **File** — List, upload, get, update, and delete Stoa files.
- **Folder** — List, create, get, update, and delete Stoa folders.
- **Workflow** — Review documents, summarize, and extract legal references.
- **Playbook** — List validation Playbooks.

Chat is intentionally not an action in this node. Existing chat workflows must
migrate to **Stoa Chat Model** plus n8n's **AI Agent**.

## Credentials

Both nodes use the same **Stoa API** credential. Set the API key created in Stoa
settings. The API base URL defaults to `https://app.stoa.legal`; change it only
for local development. For step-by-step instructions, see the [Stoa documentation](https://www.stoa.legal/docs/getting-started/how-to-create-api-key).

## Compatibility

Requires an n8n version that supports community AI language-model nodes and the
`AiLanguageModel` connection. Version 2.0 is a breaking migration for workflows
that used the removed Chat action.

## Release

From a clean branch with CI passing, run:

```bash
export GITHUB_TOKEN="$(gh auth token)"
nvm use
npm run release
```

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [stoa.legal documentation](https://www.stoa.legal/docs)
