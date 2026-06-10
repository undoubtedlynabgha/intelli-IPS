import React, { useState, useEffect, useRef } from 'react';
import { Device, Alert, LogEntry, CopilotMessage } from '../types';
import Groq from 'groq-sdk';

interface CopilotProps {
  devices?: Device[];
  alerts?: Alert[];
  logs?: LogEntry[];
  metrics?: any;
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  messages: CopilotMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CopilotMessage[]>>;
}

const SUGGESTED_PROMPTS = [
  { label: 'Summarize Network Health', text: 'Analyze our current network health and summarize the state of our device topology.' },
  { label: 'Explain Latest Alert', text: 'Check the threat alarms and explain the latest threat alert and quarantine action taken by the IPS.' },
  { label: 'Blocked IPs & Silos', text: 'List all blocked IPs and quarantined silos. Explain what rules led to their isolation.' },
  { label: 'Optimize Detection Rate', text: 'Analyze our live telemetry metrics and suggest concrete actions to improve or optimize our detection rate.' }
];

const Copilot: React.FC<CopilotProps> = ({
  devices = [],
  alerts = [],
  logs = [],
  metrics = {},
  onNotify,
  messages,
  setMessages
}) => {
  const detectionRateVal = metrics?.detection_rate != null ? `${Math.round(metrics.detection_rate)}%` : '98%';
  const fpRateVal = metrics?.false_positive_rate != null ? `${Math.round(metrics.false_positive_rate)}%` : '2%';

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messageEndRef = useRef<HTMLDivElement>(null);

  const getGroqApiKey = () => {
    if (window.electron && typeof window.electron.getApiKey === 'function') {
      const dynKey = window.electron.getApiKey();
      if (dynKey) return dynKey;
    }
    return process.env.GROQ_API_KEY || '';
  };

  const isApiKeyConfigured = () => {
    const key = getGroqApiKey();
    return typeof key === 'string' && key.trim().length > 10;
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    
    // Check key configuration
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      onNotify('Groq API Key is not configured. Please add it to .env.local', 'error');
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = { sender: 'user', text: textToSend, timestamp };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

      // Gather live state parameters to feed LLM context
      const devText = devices
        .map(d => `- Node: ${d.name} | ID: ${d.id} | Class: ${d.type} | IP: ${d.ip || 'N/A'} | Status: ${d.status} | Allowed: ${d.allowed}`)
        .join('\n');

      const alertText = alerts.slice(0, 10).length > 0
        ? alerts.slice(0, 10).map(a => `- [${a.timestamp}] Threat: ${a.threat} | Device: ${a.deviceId} | Risk: ${a.risk} | Action: ${a.actionTaken}`).join('\n')
        : 'No recent threat alerts triggered.';

      const logText = logs.slice(0, 12).length > 0
        ? logs.slice(0, 12).map(l => `- [${l.timestamp}] ${l.category}: ${l.message} (Status: ${l.status})`).join('\n')
        : 'No log entries available.';
      const activeAttackVal = metrics?.active_attack || 'None';

      const systemPrompt = `You are "Intelli IPS Copilot", an expert autonomous AI agent embedded inside the Intelli Intrusion Prevention System. 
You provide clear, technical, and actionable security insights to network operations teams.

Here is the LIVE TELEMETRY snapshot of the network:
---
[LIVE METRICS]
- Total Packets Routed: ${metrics?.total_packets ?? 0}
- Total Alerts Triggered: ${metrics?.total_alerts ?? 0}
- Current Detection Rate: ${detectionRateVal}
- False Positive Rate: ${fpRateVal}
- Active Attack Vector: ${activeAttackVal}

[DEVICE REGISTRY]
${devText || 'No devices registered.'}

[LATEST SYSTEM ALERTS]
${alertText}

[LATEST EVENT LOGS]
${logText}
---

Your response guidelines:
1. Always maintain context of the live metrics, device list, and quarantine logs provided above.
2. Keep your answers short, concise, and highly precise (maximum of 1-2 paragraphs or bullet points). Avoid lengthy explanations.
3. Always write the device name *before* the device IP address (e.g., \`Front_Door_Camera\` (\`192.168.1.105\`)). Do not write the IP address before the device name under any circumstance.
4. Reference specific device names, IPs, timestamps, and alert types.
5. If an attack is active, analyze the vector and explain what the IPS is doing (e.g. dropping packet rates, quarantining nodes).
6. If asked why a node is quarantined or blocked, look for it in the device registry and explain the mitigation triggers.
7. Format code elements (IPs, MACs, ports, protocols, or actions like BLOCKED) using single backticks (e.g., \`192.168.1.50\`, \`MQTT\`).
8. Do not include introductory filler or preambles like "Based on the live data provided...". Answer directly as an embedded security system.
9. Keep responses structured, concise, and highly professional.`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({
            role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: m.text
          })),
          { role: 'user', content: textToSend }
        ]
      });

      const aiText = response.choices[0]?.message?.content || 'Error: Could not retrieve analysis from Groq AI.';
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: `**ERROR:** Failed to communicate with Groq AI API. Details:\n\n\`${errorMsg}\`\n\nPlease check your internet connection or verify the GROQ_API_KEY in your configuration.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      onNotify('Copilot command failed — check API configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage(inputText);
    }
  };

  // Helper to render basic markdown bold/code styles in text simply
  const renderMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Basic paragraph/list spacing helper
      let processed = line;
      
      // Handle bold blocks (**bold**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(processed)) !== null) {
        if (match.index > lastIndex) {
          parts.push(processed.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="text-blue-400 dark:text-blue-300 font-bold">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      
      if (lastIndex < processed.length) {
        parts.push(processed.substring(lastIndex));
      }
      
      // If we found bold segments, build them back
      let element: React.ReactNode = parts.length > 0 ? parts : processed;

      // Handle single backtick code blocks (`code`)
      if (typeof element === 'string') {
        const codeRegex = /`(.*?)`/g;
        const codeParts = [];
        let codeLastIndex = 0;
        let codeMatch;
        
        while ((codeMatch = codeRegex.exec(element)) !== null) {
          if (codeMatch.index > codeLastIndex) {
            codeParts.push(element.substring(codeLastIndex, codeMatch.index));
          }
          codeParts.push(<code key={codeMatch.index} className="px-1.5 py-0.5 bg-surface-highlight dark:bg-[#222] border border-surface dark:border-surface-highlight font-mono text-emerald-400 dark:text-emerald-300 text-xs">{codeMatch[1]}</code>);
          codeLastIndex = codeRegex.lastIndex;
        }
        
        if (codeLastIndex < element.length) {
          codeParts.push(element.substring(codeLastIndex));
        }
        if (codeParts.length > 0) {
          element = codeParts;
        }
      } else if (Array.isArray(element)) {
        // Map arrays to handle nested code backticks
        element = element.map((part, pIdx) => {
          if (typeof part === 'string') {
            const codeRegex = /`(.*?)`/g;
            const codeParts = [];
            let codeLastIndex = 0;
            let codeMatch;
            
            while ((codeMatch = codeRegex.exec(part)) !== null) {
              if (codeMatch.index > codeLastIndex) {
                codeParts.push(part.substring(codeLastIndex, codeMatch.index));
              }
              codeParts.push(<code key={codeMatch.index} className="px-1.5 py-0.5 bg-surface-highlight dark:bg-[#222] border border-surface dark:border-surface-highlight font-mono text-emerald-400 dark:text-emerald-300 text-xs">{codeMatch[1]}</code>);
              codeLastIndex = codeRegex.lastIndex;
            }
            
            if (codeLastIndex < part.length) {
              codeParts.push(part.substring(codeLastIndex));
            }
            return codeParts.length > 0 ? <React.Fragment key={pIdx}>{codeParts}</React.Fragment> : part;
          }
          return part;
        });
      }

      return (
        <p key={idx} className="mb-3 leading-relaxed text-xs sm:text-sm whitespace-pre-line last:mb-0 font-mono">
          {element}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background dark:bg-[#050505]">
      
      {/* Top Advisory bar */}
      <div className="h-11 border-b border-surface dark:border-surface-highlight bg-surface/30 dark:bg-surface-dark/30 flex items-center px-6 gap-3 shrink-0 backdrop-blur-sm z-20 justify-between">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_6px_#3b82f6]"></span>
            <span>Agentic SecOps Module</span>
          </span>
          <span className="text-muted dark:text-gray-500 font-bold">|</span>
          <span className="text-muted dark:text-gray-400">Llama-3.3-70b Core</span>
        </div>
        <div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold uppercase ${
            isApiKeyConfigured()
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/50' 
              : 'bg-red-950/60 text-red-400 border-red-500/50'
          }`}>
            <span className={`size-1.5 rounded-full ${
              isApiKeyConfigured()
                ? 'bg-emerald-500' 
                : 'bg-red-500 font-bold'
            }`}></span>
            Groq: {isApiKeyConfigured() ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Chat view pane */}
        <div className="flex-1 flex flex-col min-w-0 bg-background dark:bg-[#070707] relative border-r border-surface dark:border-surface-highlight">
          
          {/* Scrollable message area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-surface-highlight scrollbar-track-transparent">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase font-mono text-muted dark:text-gray-500 font-bold select-none">
                  <span className={msg.sender === 'ai' ? 'text-blue-400' : 'text-gray-400'}>
                    {msg.sender === 'ai' ? 'Copilot AI' : 'Analyst'}
                  </span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className={`p-4 border leading-relaxed break-words shadow-lg ${
                  msg.sender === 'user'
                    ? 'bg-surface dark:bg-surface-dark border-surface-highlight dark:border-surface-highlight text-main dark:text-white'
                    : 'bg-blue-950/10 dark:bg-blue-950/5 border-blue-900/30 text-main dark:text-gray-300'
                }`}>
                  {renderMessageText(msg.text)}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex flex-col mr-auto items-start max-w-[75%] animate-pulse">
                <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase font-mono text-muted dark:text-gray-500 font-bold">
                  <span className="text-blue-400">Copilot AI</span>
                  <span>•</span>
                  <span>Analyzing...</span>
                </div>
                <div className="p-4 border border-blue-900/20 bg-blue-950/5 text-muted dark:text-gray-500 font-mono text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Analyzing live telemetry patterns...
                </div>
              </div>
            )}
            
            <div ref={messageEndRef} />
          </div>

          {/* Quick-action prompts container */}
          <div className="px-6 py-3 border-t border-surface dark:border-surface-highlight bg-surface/10 dark:bg-surface-dark/10 flex flex-wrap gap-2 shrink-0">
            {SUGGESTED_PROMPTS.map((prompt, pIdx) => (
              <button
                key={pIdx}
                disabled={isLoading}
                onClick={() => handleSendMessage(prompt.text)}
                className="text-[10px] font-mono border border-surface dark:border-surface-highlight px-3 py-1.5 bg-background dark:bg-black hover:border-blue-500/50 hover:text-blue-400 transition-all uppercase outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Footer Input Area */}
          <div className="p-6 border-t border-surface dark:border-surface-highlight bg-background dark:bg-black shrink-0 flex gap-3 items-center">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              placeholder={isApiKeyConfigured() ? "Ask the security copilot... (e.g. why LOCK_EXT_01 is blocked)" : "API Key Required — configure GROQ_API_KEY in .env.local"}
              className={`flex-grow h-10 px-4 bg-surface dark:bg-surface-dark border ${
                isApiKeyConfigured() ? 'border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white' : 'border-red-900/50 bg-red-950/5 cursor-not-allowed'
              } text-main dark:text-white text-xs sm:text-sm placeholder-gray-500 outline-none transition-all font-mono`}
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={isLoading || !inputText.trim() || !isApiKeyConfigured()}
              className="h-10 px-5 bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center justify-center gap-2 outline-none disabled:bg-surface disabled:border-surface disabled:text-gray-500 cursor-pointer tracking-wider"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

        </div>

        {/* Side Panel: Context Snapshot View */}
        <div className="w-80 bg-background dark:bg-[#060606] flex flex-col shrink-0 overflow-hidden hidden lg:flex font-mono">
          <div className="px-4 py-3 border-b border-surface dark:border-surface-highlight flex items-center gap-2 bg-surface/30 dark:bg-surface-dark/30 shrink-0 select-none">
            <span className="material-symbols-outlined text-[16px] text-blue-400">database</span>
            <span className="text-xs font-bold uppercase tracking-wider text-main dark:text-white">Telemetry Context</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[10px]">
            
            {/* Live stats summary */}
            <div className="space-y-1.5 border border-surface dark:border-surface-highlight p-3 bg-surface/20 dark:bg-surface-dark/20">
              <div className="font-bold text-main dark:text-white uppercase mb-1 flex items-center gap-1.5 text-[9px]">
                <span className="size-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span>Active Snapshot</span>
              </div>
              <div className="flex justify-between text-[10px]"><span className="text-muted dark:text-gray-500">Packets Routed:</span> <span className="text-main dark:text-white">{metrics?.total_packets ?? 0}</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted dark:text-gray-500">Alerts Fired:</span> <span className="text-main dark:text-white">{metrics?.total_alerts ?? 0}</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted dark:text-gray-500">Detection Rate:</span> <span className="text-emerald-400 font-bold">{detectionRateVal}</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted dark:text-gray-500">False Positives:</span> <span className="text-blue-400 font-bold">{fpRateVal}</span></div>
            </div>

            {/* Active Devices registry */}
            <div className="space-y-2">
              <div className="font-bold text-main dark:text-white uppercase text-[9px] tracking-widest text-muted dark:text-gray-500">Device Directory ({devices.length})</div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {devices.map(d => (
                  <div key={d.id} className="p-2 border border-surface dark:border-surface-highlight bg-surface/10 dark:bg-surface-dark/10 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-main dark:text-white block truncate w-36">{d.name}</span>
                      <span className="text-[8px] text-muted dark:text-gray-600 block">{d.id} · {d.type}</span>
                    </div>
                    <div>
                      <span className={`px-1.5 py-0.5 border text-[8px] font-bold uppercase ${
                        d.status === 'blocked' ? 'bg-red-950/60 text-red-400 border-red-900/30' :
                        d.status === 'threat' ? 'bg-orange-950/60 text-orange-400 border-orange-900/30 animate-pulse' :
                        'bg-emerald-950/60 text-emerald-400 border-emerald-900/30'
                      }`}>
                        {d.status === 'blocked' ? 'Prevented' : d.status === 'threat' ? 'Threat' : 'Online'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Log Summary */}
            <div className="space-y-2">
              <div className="font-bold text-main dark:text-white uppercase text-[9px] tracking-widest text-muted dark:text-gray-500">Recent IPS Blocks</div>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {alerts.slice(0, 5).length === 0 ? (
                  <div className="p-3 border border-dashed border-surface dark:border-surface-highlight text-center text-muted dark:text-gray-600">
                    No active mitigations.
                  </div>
                ) : (
                  alerts.slice(0, 5).map(a => (
                    <div key={a.id} className="p-2 border border-red-900/20 bg-red-950/5 space-y-1">
                      <div className="flex justify-between font-bold text-red-400">
                        <span>{a.threat}</span>
                        <span className="text-[8px]">{a.timestamp}</span>
                      </div>
                      <div className="text-[8px] text-muted dark:text-gray-500 truncate">Source: {a.deviceId} · Action: {a.actionTaken}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Copilot;
