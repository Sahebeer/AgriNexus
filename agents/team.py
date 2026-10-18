"""
AgriNexus Team MCP Configuration
Defines the central `team` variable containing `team_id`, MCP connection server parameters,
and individual `agent_id` mappings for all active terminal agents.
"""

from typing import Dict, Any

team: Dict[str, Any] = {
    "team_id": "379c7832-aba0-4c43-9b69-6639c8973e66",
    "teamId": "379c7832-aba0-4c43-9b69-6639c8973e66",
    "name": "AgriNexus Multi-Terminal Agent Team",
    "mcp_server": {
        "port": 63263,
        "url": "http://127.0.0.1:63263/mcp"
    },
    "agents": {
        "apollo": {
            "name": "Apollo",
            "agent_id": "term-mtv1x22x-1",
            "agentId": "term-mtv1x22x-1",
            "role": "Antigravity Assistant",
            "workspace": "/Users/sahebjotsb/Downloads/AgriNexus-main-2",
            "mcp_capability": "VzsHQeB7Lh8VWBwWJwEwGbkTD8n3utLO3dsPYBFEDjk",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtv1x22x-1",
                "X-October-MCP-Capability": "VzsHQeB7Lh8VWBwWJwEwGbkTD8n3utLO3dsPYBFEDjk"
            }
        },
        "atlas": {
            "name": "Atlas",
            "agent_id": "term-mtv1xpzt-3",
            "agentId": "term-mtv1xpzt-3",
            "role": "Codex Agent",
            "workspace": "/Users/sahebjotsb/Downloads/AgriNexus-main-2",
            "mcp_capability": "jEy4Jpus52q0pAU3mWzM5BqwLjSijIIsI21SrZF4JIY",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtv1xpzt-3",
                "X-October-MCP-Capability": "jEy4Jpus52q0pAU3mWzM5BqwLjSijIIsI21SrZF4JIY"
            }
        },
        "athena": {
            "name": "Athena",
            "agent_id": "term-mtvm8fxz-1k",
            "agentId": "term-mtvm8fxz-1k",
            "role": "Freebuff Agent",
            "workspace": "/Users/sahebjotsb/Downloads/AgriNexus-main-2",
            "mcp_capability": "RUd4tzLNUGrtcD2B1StSUFebfFQcvDOdOgwl44_02oM",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtvm8fxz-1k",
                "X-October-MCP-Capability": "RUd4tzLNUGrtcD2B1StSUFebfFQcvDOdOgwl44_02oM"
            }
        },
        "phoenix": {
            "name": "Phoenix",
            "agent_id": "term-mtvnypho-2b",
            "agentId": "term-mtvnypho-2b",
            "role": "Terminal Agent",
            "workspace": "/Users/sahebjotsb/Downloads/AgriNexus-main-2",
            "mcp_capability": "SpobYmz8dMr3OHV65BnYH-gTr_-DLWCMiJtJzU5iE38",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtvnypho-2b",
                "X-October-MCP-Capability": "SpobYmz8dMr3OHV65BnYH-gTr_-DLWCMiJtJzU5iE38"
            }
        },
        "griffin": {
            "name": "Griffin",
            "agent_id": "term-mtvr15td-2l",
            "agentId": "term-mtvr15td-2l",
            "role": "Cursor Agent",
            "workspace": "/Users/sahebjotsb/Downloads/AgriNexus-main-2",
            "mcp_capability": "qwhUTo0-GIeH2q7X8ElPQFlmR-PS_xc4Mk1CTIg1OHo",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtvr15td-2l",
                "X-October-MCP-Capability": "qwhUTo0-GIeH2q7X8ElPQFlmR-PS_xc4Mk1CTIg1OHo"
            }
        },
        "orion": {
            "name": "Orion",
            "agent_id": "term-mtv2fgfy-c",
            "agentId": "term-mtv2fgfy-c",
            "role": "Codex Agent",
            "workspace": "/Users/sahebjotsb/October/untitled-workspace-3",
            "mcp_capability": "Rc4g1BTT0iIncK1xgxPV_NhXYNXxVKwAVFfU1ZGkwYU",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtv2fgfy-c",
                "X-October-MCP-Capability": "Rc4g1BTT0iIncK1xgxPV_NhXYNXxVKwAVFfU1ZGkwYU"
            }
        },
        "juno": {
            "name": "Juno",
            "agent_id": "term-mtv2hch3-i",
            "agentId": "term-mtv2hch3-i",
            "role": "Codex Agent",
            "workspace": "/Users/sahebjotsb/October/untitled-workspace-3",
            "mcp_capability": "3WOanhNhc1CZ8oNE6-eNn6QDdyS6M3euUN--FeaoXK8",
            "headers": {
                "X-October-Canvas": "379c7832-aba0-4c43-9b69-6639c8973e66",
                "X-October-Node": "term-mtv2hch3-i",
                "X-October-MCP-Capability": "3WOanhNhc1CZ8oNE6-eNn6QDdyS6M3euUN--FeaoXK8"
            }
        }
    }
}
