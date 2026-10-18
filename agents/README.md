# AgriNexus Agent MCP Terminal Intercommunication

This directory provides central configuration, MCP credentials, and communication utilities for all terminals and agents operating on the October canvas.

---

## 1. Central Team Variables

Both JavaScript/TypeScript and Python export a centralized `team` variable containing the `team_id` / `teamId` and individual `agent_id` / `agentId` mappings:

```json
{
  "team_id": "379c7832-aba0-4c43-9b69-6639c8973e66",
  "teamId": "379c7832-aba0-4c43-9b69-6639c8973e66",
  "name": "AgriNexus Multi-Terminal Agent Team",
  "mcp_server": {
    "port": 63263,
    "url": "http://127.0.0.1:63263/mcp"
  }
}
```

### Agent Identity Table

| Terminal Name | Role / Client | Node ID (`agent_id`) | Capability Token | Workspace |
|---|---|---|---|---|
| **Apollo** | Antigravity | `term-mtv1x22x-1` | `VzsHQeB7Lh8VWBwWJwEwGbkTD8n3utLO3dsPYBFEDjk` | `AgriNexus-main-2` |
| **Atlas** | Codex | `term-mtv1xpzt-3` | `jEy4Jpus52q0pAU3mWzM5BqwLjSijIIsI21SrZF4JIY` | `AgriNexus-main-2` |
| **Athena** | Freebuff | `term-mtvm8fxz-1k` | `RUd4tzLNUGrtcD2B1StSUFebfFQcvDOdOgwl44_02oM` | `AgriNexus-main-2` |
| **Phoenix** | Terminal | `term-mtvnypho-2b` | `SpobYmz8dMr3OHV65BnYH-gTr_-DLWCMiJtJzU5iE38` | `AgriNexus-main-2` |
| **Griffin** | Cursor | `term-mtvr15td-2l` | `qwhUTo0-GIeH2q7X8ElPQFlmR-PS_xc4Mk1CTIg1OHo` | `AgriNexus-main-2` |
| **Orion** | Codex | `term-mtv2fgfy-c` | `Rc4g1BTT0iIncK1xgxPV_NhXYNXxVKwAVFfU1ZGkwYU` | `untitled-workspace-3` |
| **Juno** | Codex | `term-mtv2hch3-i` | `3WOanhNhc1CZ8oNE6-eNn6QDdyS6M3euUN--FeaoXK8` | `untitled-workspace-3` |

---

## 2. Usage from Any Terminal

### Quick Shell Environment Setup
In any terminal, load that terminal's environment variables:
```bash
source agents/env.sh phoenix
# Or: source agents/env.sh atlas / athena / griffin / apollo
```
This exports:
- `TEAM_ID`
- `AGENT_ID`
- `OCTOBER_BUS_PORT`
- `OCTOBER_BUS_CANVAS`
- `OCTOBER_BUS_NODE`
- `OCTOBER_BUS_MCP_CAPABILITY`

---

### Node.js / CLI Intercommunication

Send a message to another terminal:
```bash
node agents/client.js --as phoenix send Apollo "Hi Apollo, Phoenix here!"
```

Check incoming messages:
```bash
node agents/client.js --as phoenix inbox
```

List active peers:
```bash
node agents/client.js peers
```

Inspect peer status / turn history:
```bash
node agents/client.js status Atlas
```

---

### Python Intercommunication

```bash
# Send message
python3 -m agents.client --as phoenix send Apollo "Hi Apollo, Phoenix here!"

# Check inbox
python3 -m agents.client --as phoenix inbox

# Peer status
python3 -m agents.client status Phoenix
```

---

### Programmatic Integration

#### TypeScript / JavaScript:
```typescript
import { team } from './agents/team';
import { TerminalAgentClient } from './agents/client';

console.log('Team ID:', team.team_id);
console.log('Apollo Agent ID:', team.agents.apollo.agent_id);

const client = new TerminalAgentClient('apollo');
await client.sendMessage('Phoenix', 'Hello Phoenix!');
```

#### Python:
```python
from agents.team import team
from agents.client import TerminalAgentClient

print("Team ID:", team["team_id"])
print("Phoenix Agent ID:", team["agents"]["phoenix"]["agent_id"])

client = TerminalAgentClient("phoenix")
client.send_message("Apollo", "Hello Apollo!")
```

---

## 3. Dedicated Drop-In MCP Configs

Dedicated drop-in config files are available in `agents/configs/`:
- `apollo.mcp.json`
- `atlas.mcp.json`
- `athena.mcp.json`
- `phoenix.mcp.json`
- `griffin.mcp.json`
- `orion.mcp.json`
- `juno.mcp.json`
