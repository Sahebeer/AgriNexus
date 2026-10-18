#!/bin/bash
# Usage: source agents/env.sh [agent_name]
# Example: source agents/env.sh phoenix

AGENT="${1:-apollo}"
AGENT_LOWER=$(echo "$AGENT" | tr '[:upper:]' '[:lower:]')

export OCTOBER_BUS_PORT="63263"
export OCTOBER_BUS_CANVAS="379c7832-aba0-4c43-9b69-6639c8973e66"
export TEAM_ID="379c7832-aba0-4c43-9b69-6639c8973e66"

case "$AGENT_LOWER" in
  apollo)
    export OCTOBER_AGENT_NAME="Apollo"
    export OCTOBER_BUS_NODE="term-mtv1x22x-1"
    export OCTOBER_BUS_MCP_CAPABILITY="VzsHQeB7Lh8VWBwWJwEwGbkTD8n3utLO3dsPYBFEDjk"
    ;;
  atlas)
    export OCTOBER_AGENT_NAME="Atlas"
    export OCTOBER_BUS_NODE="term-mtv1xpzt-3"
    export OCTOBER_BUS_MCP_CAPABILITY="jEy4Jpus52q0pAU3mWzM5BqwLjSijIIsI21SrZF4JIY"
    ;;
  athena)
    export OCTOBER_AGENT_NAME="Athena"
    export OCTOBER_BUS_NODE="term-mtvm8fxz-1k"
    export OCTOBER_BUS_MCP_CAPABILITY="RUd4tzLNUGrtcD2B1StSUFebfFQcvDOdOgwl44_02oM"
    ;;
  phoenix)
    export OCTOBER_AGENT_NAME="Phoenix"
    export OCTOBER_BUS_NODE="term-mtvnypho-2b"
    export OCTOBER_BUS_MCP_CAPABILITY="SpobYmz8dMr3OHV65BnYH-gTr_-DLWCMiJtJzU5iE38"
    ;;
  griffin)
    export OCTOBER_AGENT_NAME="Griffin"
    export OCTOBER_BUS_NODE="term-mtvr15td-2l"
    export OCTOBER_BUS_MCP_CAPABILITY="qwhUTo0-GIeH2q7X8ElPQFlmR-PS_xc4Mk1CTIg1OHo"
    ;;
  orion)
    export OCTOBER_AGENT_NAME="Orion"
    export OCTOBER_BUS_NODE="term-mtv2fgfy-c"
    export OCTOBER_BUS_MCP_CAPABILITY="Rc4g1BTT0iIncK1xgxPV_NhXYNXxVKwAVFfU1ZGkwYU"
    ;;
  juno)
    export OCTOBER_AGENT_NAME="Juno"
    export OCTOBER_BUS_NODE="term-mtv2hch3-i"
    export OCTOBER_BUS_MCP_CAPABILITY="3WOanhNhc1CZ8oNE6-eNn6QDdyS6M3euUN--FeaoXK8"
    ;;
  *)
    echo "Unknown agent: $AGENT"
    echo "Supported agents: apollo, atlas, athena, phoenix, griffin, orion, juno"
    return 1 2>/dev/null || exit 1
    ;;
esac

export AGENT_ID="$OCTOBER_BUS_NODE"

echo "Loaded MCP environment for agent: $OCTOBER_AGENT_NAME"
echo "  TEAM_ID:  $TEAM_ID"
echo "  AGENT_ID: $AGENT_ID"
echo "  PORT:     $OCTOBER_BUS_PORT"
