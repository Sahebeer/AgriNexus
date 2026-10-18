#!/usr/bin/env node
/**
 * October MCP Inter-Terminal Communication Client
 * 
 * Allows any terminal agent to communicate with peer terminals over the October MCP bus.
 * Uses the central `team` variable and respective `agent_id` / `team_id`.
 */

const { team } = require('./team');

class TerminalAgentClient {
  /**
   * @param {string} agentKey - Key in team.agents (e.g., 'apollo', 'atlas', 'phoenix', 'athena', 'griffin') or agent_id
   */
  constructor(agentKey = 'apollo') {
    const key = agentKey.toLowerCase();
    this.agent = team.agents[key] || 
      Object.values(team.agents).find(a => a.agent_id === agentKey || a.name.toLowerCase() === key);
    
    if (!this.agent) {
      throw new Error(`Agent "${agentKey}" not found in team configuration.`);
    }

    this.serverUrl = team.mcp_server.url;
    this.teamId = team.team_id;
    this.agentId = this.agent.agent_id;
  }

  /**
   * Send an RPC tool call to October MCP bus
   */
  async callTool(name, args = {}) {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'X-October-Canvas': this.teamId,
      'X-October-Node': this.agentId,
      'X-October-MCP-Capability': this.agent.mcp_capability,
      'X-October-MCP-Instance': `client-${this.agent.name.toLowerCase()}-${Date.now()}`
    };

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    
    // Parse SSE or JSON
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5).trim());
          if (json.error) throw new Error(json.error.message || 'RPC Error');
          if (json.result && json.result.content) {
            return json.result.content.map(c => c.text).join('\n');
          }
          return JSON.stringify(json.result, null, 2);
        } catch (err) {
          // continue parsing
        }
      }
    }

    try {
      const json = JSON.parse(text);
      if (json.error) throw new Error(json.error.message || 'RPC Error');
      if (json.result && json.result.content) {
        return json.result.content.map(c => c.text).join('\n');
      }
      return JSON.stringify(json.result, null, 2);
    } catch {
      return text;
    }
  }

  /**
   * Send a message to another peer terminal
   */
  async sendMessage(peerName, message, mode = 'notify') {
    return this.callTool('message_peer', {
      peer: peerName,
      message,
      mode
    });
  }

  /**
   * Check inbox for incoming messages
   */
  async checkInbox() {
    return this.callTool('check_inbox', {});
  }

  /**
   * List connected peers and their current status
   */
  async listPeers() {
    return this.callTool('list_peers', {});
  }

  /**
   * Inspect the full canvas nodes and connections
   */
  async listCanvas() {
    return this.callTool('list_canvas', {});
  }

  /**
   * Check status and recent journal of a peer
   */
  async getNodeStatus(peerName, history = false) {
    return this.callTool('get_node_status', {
      name: peerName,
      history
    });
  }

  /**
   * Connect this node to another node on the canvas
   */
  async connectTo(targetNodeName) {
    return this.callTool('connect_nodes', {
      from: this.agent.name,
      to: targetNodeName
    });
  }
}

// CLI handler if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let asAgent = process.env.OCTOBER_AGENT_NAME || 'apollo';

  let filteredArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--as' && args[i + 1]) {
      asAgent = args[++i];
    } else {
      filteredArgs.push(args[i]);
    }
  }

  const client = new TerminalAgentClient(asAgent);
  const command = filteredArgs[0] || 'help';

  (async () => {
    try {
      switch (command) {
        case 'send': {
          const peer = filteredArgs[1];
          const msg = filteredArgs.slice(2).join(' ');
          if (!peer || !msg) {
            console.error('Usage: node client.js [--as <agent>] send <peer> <message>');
            process.exit(1);
          }
          console.log(`[${client.agent.name} -> ${peer}]: Sending...`);
          const res = await client.sendMessage(peer, msg);
          console.log(res);
          break;
        }
        case 'inbox': {
          console.log(`[${client.agent.name}]: Checking inbox...`);
          const res = await client.checkInbox();
          console.log(res);
          break;
        }
        case 'peers': {
          const res = await client.listPeers();
          console.log(res);
          break;
        }
        case 'canvas': {
          const res = await client.listCanvas();
          console.log(res);
          break;
        }
        case 'status': {
          const target = filteredArgs[1] || client.agent.name;
          const res = await client.getNodeStatus(target, true);
          console.log(res);
          break;
        }
        case 'connect': {
          const target = filteredArgs[1];
          if (!target) {
            console.error('Usage: node client.js [--as <agent>] connect <target>');
            process.exit(1);
          }
          const res = await client.connectTo(target);
          console.log(res);
          break;
        }
        default:
          console.log(`
October MCP Terminal Communication Client
Agent: ${client.agent.name} (${client.agent.agent_id})
Team:  ${client.teamId}

Commands:
  node client.js [--as <agent>] send <peer> <message>   Send a message to a peer terminal
  node client.js [--as <agent>] inbox                  Check messages in inbox
  node client.js [--as <agent>] peers                  List active peers
  node client.js [--as <agent>] canvas                 List full canvas and connections
  node client.js [--as <agent>] status [peer]          Get peer status and turn history
  node client.js [--as <agent>] connect <peer>         Wire canvas connection to peer

Available agents: apollo, atlas, athena, phoenix, griffin, orion, juno
          `);
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { TerminalAgentClient, team };
