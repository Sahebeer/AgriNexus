#!/usr/bin/env python3
"""
October MCP Inter-Terminal Communication Client (Python)

Allows any terminal or Python process to communicate with peer agents over the October MCP bus.
Uses the central `team` variable, `team_id`, and `agent_id`.
"""

import sys
import json
import time
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

from agents.team import team


class TerminalAgentClient:
    def __init__(self, agent_name_or_id: str = "apollo"):
        key = agent_name_or_id.lower()
        self.team = team
        self.team_id = team["team_id"]
        self.server_url = team["mcp_server"]["url"]

        found_agent = None
        if key in team["agents"]:
            found_agent = team["agents"][key]
        else:
            for agent in team["agents"].values():
                if agent["agent_id"] == agent_name_or_id or agent["name"].lower() == key:
                    found_agent = agent
                    break

        if not found_agent:
            raise ValueError(f"Agent '{agent_name_or_id}' not found in team configuration.")

        self.agent = found_agent
        self.agent_id = self.agent["agent_id"]

    def call_tool(self, name: str, arguments: Optional[Dict[str, Any]] = None) -> str:
        if arguments is None:
            arguments = {}

        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "X-October-Canvas": self.team_id,
            "X-October-Node": self.agent_id,
            "X-October-MCP-Capability": self.agent["mcp_capability"],
            "X-October-MCP-Instance": f"py-client-{self.agent['name'].lower()}-{int(time.time())}"
        }

        req = urllib.request.Request(
            self.server_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req) as resp:
                raw_bytes = resp.read()
                raw_text = raw_bytes.decode("utf-8")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP Error {e.code}: {error_body}")

        # Parse SSE stream or JSON
        for line in raw_text.splitlines():
            if line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    parsed = json.loads(data_str)
                    if "error" in parsed:
                        raise RuntimeError(parsed["error"].get("message", "MCP RPC Error"))
                    if "result" in parsed and "content" in parsed["result"]:
                        return "\n".join(item.get("text", "") for item in parsed["result"]["content"])
                    return json.dumps(parsed.get("result", {}), indent=2)
                except json.JSONDecodeError:
                    pass

        try:
            parsed = json.loads(raw_text)
            if "error" in parsed:
                raise RuntimeError(parsed["error"].get("message", "MCP RPC Error"))
            if "result" in parsed and "content" in parsed["result"]:
                return "\n".join(item.get("text", "") for item in parsed["result"]["content"])
            return json.dumps(parsed.get("result", {}), indent=2)
        except json.JSONDecodeError:
            return raw_text

    def send_message(self, peer_name: str, message: str, mode: str = "notify") -> str:
        return self.call_tool("message_peer", {
            "peer": peer_name,
            "message": message,
            "mode": mode
        })

    def check_inbox(self) -> str:
        return self.call_tool("check_inbox", {})

    def list_peers(self) -> str:
        return self.call_tool("list_peers", {})

    def list_canvas(self) -> str:
        return self.call_tool("list_canvas", {})

    def get_node_status(self, peer_name: str, history: bool = False) -> str:
        return self.call_tool("get_node_status", {
            "name": peer_name,
            "history": history
        })

    def connect_to(self, target_node_name: str) -> str:
        return self.call_tool("connect_nodes", {
            "from": self.agent["name"],
            "to": target_node_name
        })


if __name__ == "__main__":
    args = sys.argv[1:]
    as_agent = "apollo"

    filtered_args = []
    i = 0
    while i < len(args):
        if args[i] == "--as" and i + 1 < len(args):
            as_agent = args[i + 1]
            i += 2
        else:
            filtered_args.append(args[i])
            i += 1

    client = TerminalAgentClient(as_agent)
    cmd = filtered_args[0] if filtered_args else "help"

    if cmd == "send":
        if len(filtered_args) < 3:
            print("Usage: python -m agents.client [--as <agent>] send <peer> <message>")
            sys.exit(1)
        peer = filtered_args[1]
        msg = " ".join(filtered_args[2:])
        print(f"[{client.agent['name']} -> {peer}]: Sending...")
        print(client.send_message(peer, msg))
    elif cmd == "inbox":
        print(f"[{client.agent['name']}]: Checking inbox...")
        print(client.check_inbox())
    elif cmd == "peers":
        print(client.list_peers())
    elif cmd == "canvas":
        print(client.list_canvas())
    elif cmd == "status":
        target = filtered_args[1] if len(filtered_args) > 1 else client.agent["name"]
        print(client.get_node_status(target, history=True))
    elif cmd == "connect":
        if len(filtered_args) < 2:
            print("Usage: python -m agents.client [--as <agent>] connect <peer>")
            sys.exit(1)
        target = filtered_args[1]
        print(client.connect_to(target))
    else:
        print(f"""
October MCP Terminal Communication Client (Python)
Agent: {client.agent['name']} ({client.agent_id})
Team:  {client.team_id}

Commands:
  python -m agents.client [--as <agent>] send <peer> <message>
  python -m agents.client [--as <agent>] inbox
  python -m agents.client [--as <agent>] peers
  python -m agents.client [--as <agent>] canvas
  python -m agents.client [--as <agent>] status [peer]
  python -m agents.client [--as <agent>] connect <peer>

Available agents: apollo, atlas, athena, phoenix, griffin, orion, juno
        """)
